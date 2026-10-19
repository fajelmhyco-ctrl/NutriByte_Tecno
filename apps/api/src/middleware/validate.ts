import { NextFunction, Request, Response } from "express";
import { ZodTypeAny } from "zod";

type Source = "body" | "query" | "params";

export function validate(schema: ZodTypeAny, source: Source = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === "body") {
        req.body = parsed;
      } else {
        // req.query is a getter-only property in Express, so redefine it for this request.
        Object.defineProperty(req, source, {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
