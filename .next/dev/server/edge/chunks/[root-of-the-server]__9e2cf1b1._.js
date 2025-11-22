(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push(["chunks/[root-of-the-server]__9e2cf1b1._.js",
"[externals]/node:buffer [external] (node:buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:buffer", () => require("node:buffer"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[project]/Downloads/novo-desktop-mvp (2)/middleware.ts [middleware-edge] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Downloads$2f$novo$2d$desktop$2d$mvp__$28$2$292f$node_modules$2f2e$pnpm$2f$next$2d$auth$40$4$2e$24$2e$13_next$40$16$2e$0_c820c0e7ff6e3da9d12c9a3f6111e4c4$2f$node_modules$2f$next$2d$auth$2f$middleware$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Downloads/novo-desktop-mvp (2)/node_modules/.pnpm/next-auth@4.24.13_next@16.0_c820c0e7ff6e3da9d12c9a3f6111e4c4/node_modules/next-auth/middleware.js [middleware-edge] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Downloads$2f$novo$2d$desktop$2d$mvp__$28$2$292f$node_modules$2f2e$pnpm$2f$next$2d$auth$40$4$2e$24$2e$13_next$40$16$2e$0_c820c0e7ff6e3da9d12c9a3f6111e4c4$2f$node_modules$2f$next$2d$auth$2f$middleware$2e$js__$5b$middleware$2d$edge$5d$__$28$ecmascript$29$__["withAuth"])(function middleware(req) {
// Add any additional middleware logic here
}, {
    callbacks: {
        authorized: ({ token })=>!!token
    }
});
const config = {
    matcher: [
        "/((?!api/auth|_next/static|_next/image|favicon.ico|auth/signin|auth/signup).*)"
    ]
};
}),
]);

//# sourceMappingURL=%5Broot-of-the-server%5D__9e2cf1b1._.js.map