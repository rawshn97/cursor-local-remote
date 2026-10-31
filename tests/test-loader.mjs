import { resolve as pathResolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const subpath = specifier.slice(2);
    const basePath = pathResolve(process.cwd(), "src", subpath);
    const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx", ".js"];
    let finalPath = basePath;
    if (existsSync(basePath)) {
      finalPath = basePath;
    } else {
      for (const ext of extensions) {
        if (existsSync(basePath + ext)) {
          finalPath = basePath + ext;
          break;
        }
      }
    }
    return nextResolve(pathToFileURL(finalPath).href, context);
  }
  return nextResolve(specifier, context);
}
