import fs from "fs";
import { compile, minifyHTML, read, write } from "@/engine";

function main() {
  const start = Date.now();

  try {
    const resume = read("../resume.json");

    if (!resume) throw new Error("Failed to read resume");

    const resume_data = JSON.parse(resume);

    // check if dist folder exists
    if (!fs.existsSync("dist")) {
      fs.mkdirSync("dist");
    }

    // copy every file in public to dist
    fs.readdirSync("public").forEach((file) => {
      fs.copyFileSync(`public/${file}`, `dist/${file}`);
    });

    write(
      "../dist/index.html",
      minifyHTML(compile("html/index.html", resume_data))
    );
  } catch (e) {
    console.error("Error compiling resume", e);
  } finally {
    const ms = Date.now() - start;

    console.log(`Compiled resume in ${ms}ms`);
  }
}

main();
