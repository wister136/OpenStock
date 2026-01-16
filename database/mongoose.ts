import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Build/CI 阶段跳过数据库连接：
// - Dockerfile 构建阶段：ENV SKIP_DB=true
// - Next.js build 阶段也会带 NEXT_PHASE=phase-production-build
const SHOULD_SKIP_DB =
  process.env.SKIP_DB === "true" ||
  process.env.NEXT_PHASE === "phase-production-build";

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export const connectToDatabase = async (): Promise<typeof mongoose> => {
  // ✅ 构建阶段不连接 MongoDB，但一定要返回一个“带 connection 的对象”
  // 否则上层代码如果写了 (await connectToDatabase()).connection 会直接 TypeError
  if (SHOULD_SKIP_DB) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        `[mongoose] SKIP_DB is enabled (SKIP_DB=${process.env.SKIP_DB}, NEXT_PHASE=${process.env.NEXT_PHASE}). ` +
          `Skip MongoDB connection during build/CI phase.`
      );
    }
    // 关键：返回 mongoose（它有 mongoose.connection），避免 null
    cached.conn = cached.conn ?? mongoose;
    return cached.conn;
  }

  if (!MONGODB_URI) {
    throw new Error("MongoDB URI is missing");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  console.log(
    `MongoDB Connected ${MONGODB_URI} in ${process.env.NODE_ENV ?? "unknown"}`
  );
  return cached.conn;
};
