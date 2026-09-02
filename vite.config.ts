import { defineConfig } from "vitest/config";

export default defineConfig({
	// Repo-name base so the build works when served from GitHub Pages
	// (https://<user>.github.io/helicopter-tunnel-game/).
	base: process.env.GITHUB_ACTIONS ? "/helicopter-tunnel-game/" : "/",
	build: {
		target: "es2022",
	},
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
});
