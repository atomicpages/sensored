const isTTY = process.stdout.isTTY === true;

function wrap(open: string, close: string): (text: string) => string {
  if (isTTY) {
    return (text: string) => `${open}${text}${close}`;
  }

  return (text: string) => text;
}

export const dim = wrap("\x1b[2m", "\x1b[22m");
export const bold = wrap("\x1b[1m", "\x1b[22m");
export const green = wrap("\x1b[32m", "\x1b[39m");
export const red = wrap("\x1b[31m", "\x1b[39m");
export const cyan = wrap("\x1b[36m", "\x1b[39m");
export const yellow = wrap("\x1b[33m", "\x1b[39m");
