import http2 from 'node:http2';
import { Device } from './gen/bilibili/metadata/device/device_pb.js';
import { Locale } from './gen/bilibili/metadata/locale/locale_pb.js';
import { Network, NetworkType } from './gen/bilibili/metadata/network/network_pb.js';
import { Metadata } from './gen/bilibili/metadata/metadata_pb.js';
import { DynSpaceReq, DynSpaceRsp } from './gen/bilibili/app/dynamic/v2/dynamic_pb.js';

const BASE_URL = 'https://grpc.biliapi.net';

let U8ToBase64 = function (u8) {
	return btoa(String.fromCharCode.apply(null, u8));
};

let getRandomBuvid = () => {
	let buvid = 'XX';
	let charSet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	for (let i = 0; i < 35; i++) {
		buvid += charSet.charAt(Math.floor(Math.random() * charSet.length));
	}
	return buvid;
};

let getBilibiliMetadata = (accessKey, buvid) => {
	const METADATA = {
		mobiApp: 'android',
		device: 'phone',
		build: 8920300,
		channel: 'bili',
		buvid: buvid,
		platform: 'android',
	};
	let device = new Device(METADATA);
	let locale = new Locale({ timezone: 'Asia/Shanghai' });
	let network = new Network({ type: NetworkType.WIFI });
	let bili_metadata = new Metadata(METADATA);
	let authorization = 'identify_v1 ' + accessKey;

	let device_base64 = U8ToBase64(device.toBinary());
	let locale_base64 = U8ToBase64(locale.toBinary());
	let network_base64 = U8ToBase64(network.toBinary());
	let bili_metadata_base64 = U8ToBase64(bili_metadata.toBinary());
	return { device: device_base64, locale: locale_base64, network: network_base64, bili_metadata: bili_metadata_base64, authorization };
};

let getHeaders = (accessKey = '') => {
	let buvid = getRandomBuvid();
	let { device, locale, network, bili_metadata, authorization } = getBilibiliMetadata(accessKey, buvid);
	return {
		'content-type': 'application/grpc',
		'x-bili-metadata-bin': bili_metadata,
		'x-bili-device-bin': device,
		'x-bili-locale-bin': locale,
		'x-bili-network-bin': network,
		buvid: buvid,
		authorization: authorization,
		'user-agent':
			'Dalvik/2.1.0 (Linux; U; Android 12; M2007J3SC Build/SKQ1.211006.001) 8.92.0 os/android model/M2007J3SC mobi_app/android build/8920300 channel/master innerVer/8920310 osVer/12 network/2 grpc-java-cronet/1.36.1',
		te: 'trailers',
	};
};

let dataToGrpc = (data) => {
	let message = new Uint8Array(data);
	let length = message.length;
	let data_bin = new Uint8Array(length + 5);
	data_bin[0] = 0;
	data_bin[1] = (length >> 24) & 0xff;
	data_bin[2] = (length >> 16) & 0xff;
	data_bin[3] = (length >> 8) & 0xff;
	data_bin[4] = length & 0xff;
	data_bin.set(message, 5);
	return data_bin;
};

// --- persistent http2 session ---
let session = null;

let getSession = () => {
	if (session && !session.destroyed) return session;
	session = http2.connect(BASE_URL, {});
	session.on('close', () => {
		session = null;
	});
	session.on('error', () => {
		session?.close();
		session = null;
	});
	return session;
};

// keepalive: 每 30 秒 ping，防止 idle 断开
let keepAliveTimer = setInterval(() => {
	if (session && !session.destroyed) {
		session.ping((err) => {
			if (err) {
				session.close();
				session = null;
			}
		});
	}
}, 30000);
keepAliveTimer.unref?.();

let GetDynSpace = async (uid, accessKey = '') => {
	let req_bin = new DynSpaceReq({ hostUid: uid }).toBinary();
	let headers = getHeaders(accessKey);
	let retry_max = 3;

	for (let i = 0; i < retry_max; i++) {
		try {
			let rsp = await new Promise((resolve, reject) => {
				let client = getSession();

				let req = client.request({
					':method': 'POST',
					':path': '/bilibili.app.dynamic.v2.Dynamic/DynSpace',
					...headers,
				});
				let timer = setTimeout(() => {
					req.close();
					reject(new Error('gRPC request timed out after 15000ms'));
				}, 15000);
				timer.unref?.();

				let chunks = [];
				req.on('data', (chunk) => chunks.push(chunk));
				req.on('end', () => {
					clearTimeout(timer);
					resolve(Buffer.concat(chunks));
				});
				req.on('error', (err) => {
					clearTimeout(timer);
					reject(err);
				});

				req.write(dataToGrpc(req_bin));
				req.end();
			});

			if (rsp.length <= 5) {
				throw new Error(`gRPC response too short: ${rsp.length} bytes`);
			}
			let rsp_bin = new Uint8Array(rsp.slice(5));
			let dynSpaceRsp = new DynSpaceRsp();
			dynSpaceRsp.fromBinary(rsp_bin);
			let jsonStr = dynSpaceRsp.toJsonString();
			if (!jsonStr.includes('"list"')) {
				console.warn(`[gRPC] uid=${uid} response missing "list": ${jsonStr.slice(0, 200)}`);
			}
			return jsonStr;
		} catch (e) {
			console.error(`[gRPC] uid=${uid} attempt ${i + 1}/${retry_max}:`, e.message);
			// 请求失败时销毁 session，下次重建
			if (session) {
				session.close();
				session = null;
			}
			if (i === retry_max - 1) throw e;
			await new Promise((r) => setTimeout(r, (i + 1) * 500));
		}
	}
};

let CloseDynSession = () => {
	if (session && !session.destroyed) {
		session.close();
	}
	session = null;
};

export { GetDynSpace, CloseDynSession };
