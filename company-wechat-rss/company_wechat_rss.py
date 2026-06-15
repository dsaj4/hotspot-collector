import argparse
import csv
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "http://127.0.0.1:4000"
DEFAULT_LIMIT = 20
DEFAULT_PAGE = 1
DEFAULT_TIMEOUT = 30
CSV_FIELDNAMES = [
    "company",
    "feed_id",
    "public_account",
    "article_id",
    "title",
    "article_url",
    "published_at",
    "image_url",
    "summary_html",
    "content_html",
    "source_feed_url",
    "source_home_page_url",
    "exported_at",
]


@dataclass(frozen=True)
class CompanyFeed:
    company: str
    feed_id: str
    account_name: str | None = None
    limit: int | None = None
    page: int | None = None


def project_root() -> Path:
    return Path(__file__).resolve().parent


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_base_url(base_url: str) -> str:
    return base_url.rstrip("/")


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_json_file(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_file(path: Path, payload: Any) -> None:
    ensure_parent(path)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def fetch_json(url: str, timeout: int = DEFAULT_TIMEOUT) -> Any:
    request = Request(url, headers={"User-Agent": "company-wechat-rss/1.0"})
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


class WeWeRssClient:
    def __init__(self, base_url: str = DEFAULT_BASE_URL, timeout: int = DEFAULT_TIMEOUT):
        self.base_url = normalize_base_url(base_url)
        self.timeout = timeout

    def _build_url(self, path: str, **params: Any) -> str:
        clean_params = {key: value for key, value in params.items() if value is not None}
        query = urlencode(clean_params)
        if query:
            return f"{self.base_url}{path}?{query}"
        return f"{self.base_url}{path}"

    def fetch_feed_catalog(self) -> list[dict[str, Any]]:
        return fetch_json(self._build_url("/feeds/"), timeout=self.timeout)

    def fetch_json_feed(
        self,
        feed_id: str,
        *,
        limit: int = DEFAULT_LIMIT,
        page: int = DEFAULT_PAGE,
        update: bool = False,
    ) -> dict[str, Any]:
        return fetch_json(
            self._build_url(
                f"/feeds/{feed_id}.json",
                limit=limit,
                page=page,
                update="true" if update else None,
            ),
            timeout=self.timeout,
        )


def normalize_company_feeds(company_item: dict[str, Any]) -> list[CompanyFeed]:
    company_name = (company_item.get("company") or "").strip()
    if not company_name:
        raise ValueError("Each company entry must include a non-empty 'company' field.")

    feeds: list[CompanyFeed] = []

    for feed_id in company_item.get("feed_ids", []):
        feed_id = str(feed_id).strip()
        if not feed_id:
            continue
        feeds.append(CompanyFeed(company=company_name, feed_id=feed_id))

    for feed_item in company_item.get("feeds", []):
        feed_id = str(feed_item.get("feed_id", "")).strip()
        if not feed_id:
            raise ValueError(
                f"Company '{company_name}' has a feed entry without 'feed_id'."
            )
        feeds.append(
            CompanyFeed(
                company=company_name,
                feed_id=feed_id,
                account_name=(feed_item.get("account_name") or "").strip() or None,
                limit=feed_item.get("limit"),
                page=feed_item.get("page"),
            )
        )

    if not feeds:
        raise ValueError(
            f"Company '{company_name}' must define either 'feed_ids' or 'feeds'."
        )

    return feeds


def load_company_config(path: Path) -> dict[str, Any]:
    config = read_json_file(path)
    companies = config.get("companies")
    if not isinstance(companies, list) or not companies:
        raise ValueError("Config must define a non-empty 'companies' array.")
    return config


def build_feed_catalog_index(feed_catalog: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {str(item["id"]): item for item in feed_catalog if item.get("id")}


def normalize_article_record(
    *,
    company_feed: CompanyFeed,
    feed_payload: dict[str, Any],
    feed_catalog_index: dict[str, dict[str, Any]],
    exported_at: str,
) -> list[dict[str, Any]]:
    catalog_item = feed_catalog_index.get(company_feed.feed_id, {})
    public_account = (
        company_feed.account_name
        or feed_payload.get("title")
        or catalog_item.get("name")
        or company_feed.feed_id
    )
    source_feed_url = feed_payload.get("feed_url", "")
    source_home_page_url = feed_payload.get("home_page_url", "")

    records: list[dict[str, Any]] = []
    for item in feed_payload.get("items", []):
        records.append(
            {
                "company": company_feed.company,
                "feed_id": company_feed.feed_id,
                "public_account": public_account,
                "article_id": item.get("id", ""),
                "title": item.get("title", ""),
                "article_url": item.get("url", ""),
                "published_at": item.get("date_published", ""),
                "image_url": item.get("image", ""),
                "summary_html": item.get("summary", ""),
                "content_html": item.get("content_html", ""),
                "source_feed_url": source_feed_url,
                "source_home_page_url": source_home_page_url,
                "exported_at": exported_at,
            }
        )
    return records


def collect_company_articles(
    config: dict[str, Any],
    client: WeWeRssClient,
    *,
    update: bool = False,
    exported_at: str | None = None,
    feed_fetcher: Callable[[CompanyFeed, int, int, bool], dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    exported_at = exported_at or utc_now_iso()
    feed_catalog = client.fetch_feed_catalog()
    feed_catalog_index = build_feed_catalog_index(feed_catalog)

    default_limit = int(config.get("default_limit", DEFAULT_LIMIT))
    default_page = int(config.get("default_page", DEFAULT_PAGE))

    records: list[dict[str, Any]] = []

    def default_fetcher(
        company_feed: CompanyFeed, limit: int, page: int, should_update: bool
    ) -> dict[str, Any]:
        return client.fetch_json_feed(
            company_feed.feed_id,
            limit=limit,
            page=page,
            update=should_update,
        )

    active_fetcher = feed_fetcher or default_fetcher

    for company_item in config["companies"]:
        for company_feed in normalize_company_feeds(company_item):
            limit = company_feed.limit or default_limit
            page = company_feed.page or default_page
            feed_payload = active_fetcher(company_feed, limit, page, update)
            records.extend(
                normalize_article_record(
                    company_feed=company_feed,
                    feed_payload=feed_payload,
                    feed_catalog_index=feed_catalog_index,
                    exported_at=exported_at,
                )
            )

    return records, feed_catalog


def write_csv_file(path: Path, rows: list[dict[str, Any]]) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in CSV_FIELDNAMES})


def export_company_data(
    *,
    config_path: Path,
    output_root: Path,
    base_url_override: str | None = None,
    update: bool = False,
    run_label: str | None = None,
) -> dict[str, Path]:
    config = load_company_config(config_path)
    base_url = base_url_override or config.get("base_url") or DEFAULT_BASE_URL
    timeout = int(config.get("timeout", DEFAULT_TIMEOUT))
    client = WeWeRssClient(base_url=base_url, timeout=timeout)
    exported_at = utc_now_iso()
    records, feed_catalog = collect_company_articles(
        config,
        client,
        update=update,
        exported_at=exported_at,
    )

    run_name = run_label or datetime.now().strftime("%Y%m%d-%H%M%S")
    run_dir = output_root / run_name
    run_dir.mkdir(parents=True, exist_ok=True)

    json_path = run_dir / "company_articles.json"
    csv_path = run_dir / "company_articles.csv"
    feed_catalog_path = run_dir / "feed_catalog.json"
    manifest_path = run_dir / "export_manifest.json"

    write_json_file(json_path, records)
    write_csv_file(csv_path, records)
    write_json_file(feed_catalog_path, feed_catalog)
    write_json_file(
        manifest_path,
        {
            "base_url": normalize_base_url(base_url),
            "exported_at": exported_at,
            "record_count": len(records),
            "company_count": len(config["companies"]),
            "config_path": str(config_path),
            "update_requested": update,
            "files": {
                "company_articles_json": str(json_path),
                "company_articles_csv": str(csv_path),
                "feed_catalog_json": str(feed_catalog_path),
            },
        },
    )

    return {
        "run_dir": run_dir,
        "json_path": json_path,
        "csv_path": csv_path,
        "feed_catalog_path": feed_catalog_path,
        "manifest_path": manifest_path,
    }


def command_list_feeds(args: argparse.Namespace) -> int:
    client = WeWeRssClient(base_url=args.base_url, timeout=args.timeout)
    feed_catalog = client.fetch_feed_catalog()

    if args.output:
        write_json_file(Path(args.output), feed_catalog)

    print(f"Found {len(feed_catalog)} feeds at {normalize_base_url(args.base_url)}")
    for item in feed_catalog:
        print(f"- {item.get('id', '')}: {item.get('name', '')}")
    if args.output:
        print(f"Saved catalog to {Path(args.output).resolve()}")
    return 0


def command_export_company_data(args: argparse.Namespace) -> int:
    output_paths = export_company_data(
        config_path=Path(args.config),
        output_root=Path(args.output_root),
        base_url_override=args.base_url,
        update=args.update,
        run_label=args.run_label,
    )
    print(f"Export completed: {output_paths['run_dir'].resolve()}")
    print(f"- JSON: {output_paths['json_path'].resolve()}")
    print(f"- CSV: {output_paths['csv_path'].resolve()}")
    print(f"- Feed catalog: {output_paths['feed_catalog_path'].resolve()}")
    print(f"- Manifest: {output_paths['manifest_path'].resolve()}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export company-grouped public account data from a local WeWe RSS instance."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser(
        "list-feeds",
        help="List currently subscribed public account feeds from WeWe RSS.",
    )
    list_parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"WeWe RSS base URL. Default: {DEFAULT_BASE_URL}",
    )
    list_parser.add_argument(
        "--timeout",
        type=int,
        default=DEFAULT_TIMEOUT,
        help=f"HTTP timeout in seconds. Default: {DEFAULT_TIMEOUT}",
    )
    list_parser.add_argument(
        "--output",
        default=None,
        help="Optional path to save the feed catalog as JSON.",
    )
    list_parser.set_defaults(func=command_list_feeds)

    export_parser = subparsers.add_parser(
        "export-company-data",
        help="Export company-grouped article data into JSON and CSV.",
    )
    export_parser.add_argument(
        "--config",
        required=True,
        help="Path to the company mapping JSON config.",
    )
    export_parser.add_argument(
        "--base-url",
        default=None,
        help="Optional WeWe RSS base URL override.",
    )
    export_parser.add_argument(
        "--output-root",
        default=str(project_root() / "output" / "company-data"),
        help="Directory where run outputs should be created.",
    )
    export_parser.add_argument(
        "--run-label",
        default=None,
        help="Optional fixed output folder name for the current export run.",
    )
    export_parser.add_argument(
        "--update",
        action="store_true",
        help="Trigger asynchronous feed update requests before reading the current feed snapshot.",
    )
    export_parser.set_defaults(func=command_export_company_data)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
