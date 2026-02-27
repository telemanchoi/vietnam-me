import type { Decimal } from "@prisma/client/runtime/library";

export type Serialized<T> = T extends Date
  ? string
  : T extends Decimal
    ? number
    : T extends Array<infer U>
      ? Array<Serialized<U>>
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export function serialize<T>(data: T): Serialized<T> {
  return JSON.parse(JSON.stringify(data));
}
