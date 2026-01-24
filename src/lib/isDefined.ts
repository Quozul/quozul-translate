export const isDefined = <T>(val: T | null | undefined): val is T => val !== null;
