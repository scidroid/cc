import fs from "fs";
import path from "path";
import { compile, minifyHTML, read, write } from "@/engine";
import { $ } from "bun";

type JsonObject = Record<string, unknown>;

/**
 * Normalize a name to a filename: "Juan Almanza" -> "juan_almanza_cv"
 */
function normalizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9\s]/g, "") // Remove special chars
    .trim()
    .replace(/\s+/g, "_") + "_cv";
}

/**
 * Deep merge two objects, with source values overwriting target values
 */
function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as JsonObject, sourceVal as JsonObject);
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

async function generatePDF(outputDir: string, filename: string = "resume") {
  try {
    await $`cd ${outputDir} && pdflatex -interaction=nonstopmode ${filename}.tex`.quiet();
    await $`cd ${outputDir} && pdflatex -interaction=nonstopmode ${filename}.tex`.quiet();

    // Clean up auxiliary files
    ["aux", "log", "out", "tex"].forEach((ext) => {
      try {
        fs.unlinkSync(path.join(outputDir, `${filename}.${ext}`));
      } catch {}
    });

    return true;
  } catch (error) {
    console.error(`Failed to generate PDF in ${outputDir}:`, error);
    return false;
  }
}

async function main() {
  const start = Date.now();
  const skipPDF = process.argv.includes("--no-pdf");

  try {
    // Read and parse resume data
    const resumeData = JSON.parse(read("../resume.json"));

    // Ensure directories exist
    fs.mkdirSync("docs", { recursive: true });
    fs.mkdirSync(path.resolve(__dirname, "../.hidden"), { recursive: true });

    // Copy public files if they exist
    const publicDir = path.resolve(__dirname, "../public");
    const docsDir = path.resolve(__dirname, "../docs");
    if (fs.existsSync(publicDir)) {
      fs.cpSync(publicDir, docsDir, { recursive: true });
    }

    // Generate normalized filename from name
    const pdfName = normalizeFilename(resumeData.name || "resume");

    // Add pdfFilename to data for HTML template
    const htmlData = { ...resumeData, pdfFilename: pdfName };

    // Generate public HTML version
    write("../docs/index.html", minifyHTML(compile("html/index.html", htmlData)));
    console.log("HTML generated");

    if (!skipPDF) {
      // Generate public PDF
      write(`../docs/${pdfName}.tex`, compile("latex/resume.tex", resumeData));
      console.log("Generating public PDF...");
      const publicSuccess = await generatePDF(docsDir, pdfName);
      console.log(publicSuccess ? `Public PDF generated: ${pdfName}.pdf` : "Public PDF failed");

      // Copy to resume.pdf and cv.pdf for backwards compatibility
      if (publicSuccess) {
        const pdfPath = path.join(docsDir, `${pdfName}.pdf`);
        fs.copyFileSync(pdfPath, path.join(docsDir, "resume.pdf"));
        fs.copyFileSync(pdfPath, path.join(docsDir, "cv.pdf"));
        console.log("Copied to resume.pdf and cv.pdf");
      }

      // Generate private PDF with secret data if secret.json exists
      const secretPath = path.resolve(__dirname, "../.hidden/secret.json");
      if (fs.existsSync(secretPath)) {
        const secretData = JSON.parse(fs.readFileSync(secretPath, "utf-8"));
        const privateData = deepMerge(resumeData, secretData);

        const hiddenDir = path.resolve(__dirname, "../.hidden");
        fs.writeFileSync(
          path.join(hiddenDir, `${pdfName}.tex`),
          compile("latex/resume.tex", privateData)
        );

        console.log("Generating private PDF...");
        const privateSuccess = await generatePDF(hiddenDir, pdfName);
        console.log(privateSuccess ? `Private PDF generated: ${pdfName}.pdf` : "Private PDF failed");
      }
    } else {
      console.log("Skipping PDF generation");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    console.log(`Completed in ${Date.now() - start}ms`);
  }
}

main();
