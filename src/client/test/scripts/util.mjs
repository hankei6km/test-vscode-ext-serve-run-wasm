export function dataToNumberArray(data) {
  return Array.from(
    (() => {
      if (typeof data === "string") {
        return new TextEncoder().encode(data);
      } else if (Array.isArray(data)) {
        return new Uint8Array(data);
      } else if (data instanceof Uint8Array) {
        return data;
      }
      throw new Error("invalid data type");
    })()
  );
}

export function getRouteAndArgs(url) {
  const p = (() => {
    const p = url.split("?", 2);
    return p.length > 1 ? p : [p[0], ""];
  })();
  const parsed = new URLSearchParams(p[1]);
  const args = (() => {
    const argsStr = parsed.get("args");
    if (argsStr) {
      try {
        const a = JSON.parse(argsStr);
        if (Array.isArray(a)) {
          return a.map((v) => `${v}`);
        }
      } catch (e) {}
    }
    return [];
  })();
  return {
    route: p[0],
    args,
  };
}
