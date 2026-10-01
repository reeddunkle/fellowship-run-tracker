import * as NetAddress from "effect/net/NetAddress";

export function getBaseUrl(address: NetAddress.SocketAddress) {
  if (NetAddress.isUnixPathAddress(address)) {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostAddress = NetAddress.isUnspecified(address.address)
    ? NetAddress.inetAddressUnsafe(NetAddress.ipv4Loopback, address.port)
    : address;

  return NetAddress.formatUrlUnsafe(hostAddress);
}
