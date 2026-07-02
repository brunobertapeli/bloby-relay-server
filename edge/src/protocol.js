// Carrier wire protocol (DO side). Mirrored by the agent in
// Bloby/supervisor/relay-tunnel.ts — keep the two in sync.
//
// Every carrier message is one binary WS frame:
//   [type:u8][flags:u8][streamId:u32 BE][payload...]   (6-byte header)
//
// streamId 0 = session control (HELLO/PING/PONG/GOAWAY). All other ids are
// allocated by the DO (the sole allocator) so the two sides never collide.
// A stream's frames may travel on EITHER carrier (control or bulk); the receiver
// correlates purely by streamId, so bulk bytes never head-of-line-block control
// frames (they ride a separate TCP connection).

export const T = {
  HELLO: 0x00,
  HELLO_ACK: 0x01,
  PING: 0x02,
  PONG: 0x03,
  GOAWAY: 0x04,
  OPEN: 0x10,   // {kind:'http'|'ws', method, url, headers, remoteIp, class}
  RESP: 0x11,   // {status, statusText, headers}
  DATA: 0x12,   // raw bytes (body chunk / ws message payload)
  WINDOW_UPDATE: 0x13, // payload = u32 BE credit (bytes)
  CLOSE: 0x14,  // half-close / ws close ({code,reason} json for ws, empty for http)
  RESET: 0x15,  // payload = 1 byte code
};

export const F = {
  END: 0x01,        // last DATA for this direction of the stream
  WS_BINARY: 0x02,  // DATA payload is a binary ws message (else text)
};

export const CLASS = { CONTROL: 0, INTERACTIVE: 1, BULK: 2 };

export const HEADER = 6;

export function encodeFrame(type, flags, streamId, payload) {
  const body = payload
    ? (payload instanceof Uint8Array ? payload : new Uint8Array(payload))
    : new Uint8Array(0);
  const buf = new Uint8Array(HEADER + body.length);
  const dv = new DataView(buf.buffer);
  buf[0] = type;
  buf[1] = flags;
  dv.setUint32(2, streamId >>> 0, false);
  buf.set(body, HEADER);
  return buf;
}

export function encodeJson(type, streamId, obj, flags = 0) {
  return encodeFrame(type, flags, streamId, new TextEncoder().encode(JSON.stringify(obj)));
}

export function decodeFrame(data) {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  return {
    type: u8[0],
    flags: u8[1],
    streamId: dv.getUint32(2, false),
    payload: u8.subarray(HEADER),
  };
}

export function payloadJson(payload) {
  return JSON.parse(new TextDecoder().decode(payload));
}

export function u32(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

export function readU32(payload) {
  return new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(0, false);
}
