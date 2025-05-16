import fs from "fs";
import path from "path";
import { compile, minifyHTML, read, write } from "@/engine";
import { $ } from "bun";

async function generatePDF() {
  try {
    // Run pdflatex twice for proper references
    await $`cd docs && pdflatex resume.tex`;
    await $`cd docs && pdflatex resume.tex`;

    // Clean up auxiliary files
    ["aux", "log", "out", "tex"].forEach((ext) => {
      try {
        fs.unlinkSync(path.join("docs", `resume.${ext}`));
      } catch {}
    });

    return true;
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    return false;
  }
}

async function main() {
  const start = Date.now();
  const skipPDF = process.argv.includes("--no-pdf");

  try {
    // Read and parse resume data
    const resumeData = JSON.parse(read("../resume.json"));

    // Ensure docs directory exists
    fs.mkdirSync("docs", { recursive: true });

    // Copy public files if they exist
    if (fs.existsSync("public")) {
      fs.cpSync("public", "docs", { recursive: true });
    }

    // Generate HTML version
    write(
      "../docs/index.html",
      minifyHTML(compile("html/index.html", resumeData))
    );

    if (!skipPDF) {
      // Generate LaTeX version
      write("../docs/resume.tex", compile("latex/resume.tex", resumeData));

      // Generate PDF
      console.log("Generating PDF...");
      const success = await generatePDF();
      console.log(
        success ? "PDF generated successfully" : "Failed to generate PDF"
      );
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
