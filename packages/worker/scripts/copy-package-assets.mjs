import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(packageRoot, "..", "..");

function copyFile(source, destination) {
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination);
}

function copyDirectory(source, destination) {
	if (!existsSync(source)) {
		throw new Error(`Required build asset directory does not exist: ${source}`);
	}

	rmSync(destination, { recursive: true, force: true });
	mkdirSync(dirname(destination), { recursive: true });
	cpSync(source, destination, { recursive: true });
}

function copyMarkdownFiles(sourceDirectory, destinationDirectory) {
	mkdirSync(destinationDirectory, { recursive: true });

	for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
		if (entry.isFile() && entry.name.endsWith(".md")) {
			copyFile(
				join(sourceDirectory, entry.name),
				join(destinationDirectory, entry.name),
			);
		}
	}
}

copyDirectory(
	join(packageRoot, "..", "dashboard", "dist", "spa"),
	join(packageRoot, "dashboard"),
);
copyFile(join(repoRoot, "README.md"), join(packageRoot, "README.md"));
copyFile(join(repoRoot, "LICENSE"), join(packageRoot, "LICENSE"));
copyFile(
	join(packageRoot, "..", "docs", "index.md"),
	join(packageRoot, "docs", "index.md"),
);
copyMarkdownFiles(
	join(packageRoot, "..", "docs", "getting-started"),
	join(packageRoot, "docs", "getting-started"),
);
copyMarkdownFiles(
	join(packageRoot, "..", "docs", "guides"),
	join(packageRoot, "docs", "guides"),
);
