import fs from "fs";
import path from "path";

// This code is not guaranteed to work for all edge cases, but it worked for me, PRs welcome!

// Types
type TemplateData = Record<string, any>;
type ReplacementPattern = [RegExp, string];

/**
 * Escapes special LaTeX characters in a string.
 * @param str The string to escape.
 * @returns The escaped string.
 */
function escapeLatexSpecialChars(str: string): string {
  const replacements: ReplacementPattern[] = [
    [/\\/g, "\\textbackslash{}"],
    [/\^/g, "\\textasciicircum{}"],
    [/~/g, "\\textasciitilde{}"],
    [/&/g, "\\&"],
    [/%/g, "\\%"],
    [/\$/g, "\\$"],
    [/#/g, "\\#"],
    [/_/g, "\\_"],
    [/{/g, "\\{"],
    [/}/g, "\\}"],
  ];

  return replacements.reduce(
    (result, [regex, replacement]) => result.replace(regex, replacement),
    str
  );
}

/**
 * Process markdown-style bold syntax in a string.
 * Converts **text** to appropriate bold formatting based on the output format.
 * @param str The string to process.
 * @param isLatex Whether to use LaTeX formatting (default: false, uses HTML).
 * @returns The processed string with bold formatting.
 */
function processBoldSyntax(str: string, isLatex: boolean = false): string {
  const boldRegex = /\*\*(.*?)\*\*/g;

  if (!isLatex) {
    return str.replace(boldRegex, "<strong>$1</strong>");
  }

  const matches = Array.from(str.matchAll(boldRegex));
  if (matches.length === 0) return escapeLatexSpecialChars(str);

  // Process in reverse to avoid index changes affecting subsequent replacements
  let result = str;
  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (!match || !match[0] || !match[1]) continue;

    const fullMatch = match[0];
    const content = match[1];
    const start = match.index || 0;
    const escapedContent = escapeLatexSpecialChars(content);

    result =
      result.substring(0, start) +
      "\\textbf{" +
      escapedContent +
      "}" +
      result.substring(start + fullMatch.length);
  }

  // Handle parts outside of bold tags
  let finalResult = "";
  let insideBold = false;
  let buffer = "";

  for (let i = 0; i < result.length; i++) {
    if (result.substring(i, i + 8) === "\\textbf{") {
      finalResult += escapeLatexSpecialChars(buffer);
      buffer = "";
      finalResult += "\\textbf{";
      i += 7;
      insideBold = true;
    } else if (insideBold && result[i] === "}") {
      finalResult += buffer + "}";
      buffer = "";
      insideBold = false;
    } else {
      buffer += result[i];
    }
  }

  if (buffer) {
    finalResult += insideBold ? buffer : escapeLatexSpecialChars(buffer);
  }

  return finalResult;
}

/**
 * Gets a value from nested object using dot-notation path.
 * @param data The data object.
 * @param path The dot-notation path string.
 * @returns The value at the path or undefined.
 */
function getNestedValue(data: TemplateData, path: string): any {
  return path.split(".").reduce((acc, part) => acc && acc[part], data);
}

/**
 * Process conditionals in the template.
 * Syntax: [[if field]]...[[endif]]
 * @param template The template string.
 * @param data The data to be used in the template.
 * @returns The processed template string.
 */
function processConditionals(template: string, data: TemplateData): string {
  const ifStart = /\[\[if\s+(\w+(?:\.\w+)*)\]\]/g;
  let processedTemplate = template;
  let match;

  while ((match = ifStart.exec(processedTemplate)) !== null) {
    const [fullMatch, fieldPath] = match;
    const startIndex = match.index;

    // Find matching endif
    let level = 1;
    let searchStartIndex = startIndex + fullMatch.length;
    let endifIndex = -1;

    while (level > 0 && searchStartIndex < processedTemplate.length) {
      const nextIf = processedTemplate.indexOf("[[if", searchStartIndex);
      const nextEndif = processedTemplate.indexOf("[[endif]]", searchStartIndex);

      if (nextEndif === -1) {
        throw new Error("Unbalanced conditional: missing [[endif]]");
      }

      if (nextIf !== -1 && nextIf < nextEndif) {
        level++;
        searchStartIndex = nextIf + 4;
      } else {
        level--;
        if (level === 0) {
          endifIndex = nextEndif;
        }
        searchStartIndex = nextEndif + 9;
      }
    }

    const content = processedTemplate.substring(
      startIndex + fullMatch.length,
      endifIndex
    );
    const endIndex = endifIndex + 9;

    const value = getNestedValue(data, fieldPath);
    const hasValue = value !== undefined && value !== null && value !== "";

    if (hasValue) {
      processedTemplate =
        processedTemplate.substring(0, startIndex) +
        content +
        processedTemplate.substring(endIndex);
      ifStart.lastIndex = startIndex + content.length;
    } else {
      processedTemplate =
        processedTemplate.substring(0, startIndex) +
        processedTemplate.substring(endIndex);
      ifStart.lastIndex = startIndex;
    }
  }

  return processedTemplate;
}

/**
 * Process for loops in the template, handling nested loops correctly.
 * @param template The template string.
 * @param data The data to be used in the template.
 * @param basePath The base path to access other template files.
 * @param isLatex Whether to use LaTeX formatting for bold text.
 * @returns The processed template string.
 */
function processForLoops(
  template: string,
  data: TemplateData,
  basePath?: string,
  isLatex: boolean = false
): string {
  const forLoopStart = /\[\[for\s+(\w+)\s+in\s+(\w+(?:\.\w+)*)\]\]/g;
  let processedTemplate = template;
  let match;

  while ((match = forLoopStart.exec(processedTemplate)) !== null) {
    const [fullMatch, itemVar, arrayKey] = match;
    const startIndex = match.index;

    // Find the matching endfor by tracking nested levels
    let level = 1;
    let searchStartIndex = startIndex + fullMatch.length;
    let endforIndex = -1;
    let endIndex = searchStartIndex;

    while (level > 0 && endIndex < processedTemplate.length) {
      const forIndex = processedTemplate.indexOf("[[for", searchStartIndex);
      const nextEndforIndex = processedTemplate.indexOf(
        "[[endfor]]",
        searchStartIndex
      );

      if (nextEndforIndex === -1) {
        throw new Error("Unbalanced for loop: missing [[endfor]]");
      }

      if (forIndex !== -1 && forIndex < nextEndforIndex) {
        level++;
        searchStartIndex = forIndex + 5;
      } else {
        level--;
        searchStartIndex = nextEndforIndex + 10;

        if (level === 0) {
          endforIndex = nextEndforIndex;
          endIndex = nextEndforIndex + 10;
        }
      }
    }

    const content = processedTemplate.substring(
      startIndex + fullMatch.length,
      endforIndex
    );
    const items = getNestedValue(data, arrayKey);

    if (!Array.isArray(items)) {
      processedTemplate =
        processedTemplate.substring(0, startIndex) +
        processedTemplate.substring(endIndex);
      forLoopStart.lastIndex = startIndex;
    } else {
      const processed = items
        .map((itemData) =>
          processContent(
            content,
            { ...data, [itemVar]: itemData },
            basePath,
            isLatex
          )
        )
        .join("");

      processedTemplate =
        processedTemplate.substring(0, startIndex) +
        processed +
        processedTemplate.substring(endIndex);
      forLoopStart.lastIndex = startIndex + processed.length;
    }
  }

  return processedTemplate;
}

/**
 * Process a template content string (not a file path).
 * @param content The template content string.
 * @param data The data to be used in the template.
 * @param basePath The base path to access other template files.
 * @param isLatex Whether to use LaTeX formatting.
 * @returns The processed content string.
 */
function processContent(
  content: string,
  data: TemplateData,
  basePath?: string,
  isLatex: boolean = false
): string {
  // Process conditionals first
  let processedContent = processConditionals(content, data);

  // Process nested for loops
  processedContent = processForLoops(processedContent, data, basePath, isLatex);

  // Handle LaTeX-specific replacements
  if (isLatex) {
    // Handle tel: links before variable substitution (normalize phone numbers)
    processedContent = processedContent.replace(
      /\{tel:@\{([^}]+)\}@\}/g,
      (match, key) => {
        const phone = String(getNestedValue(data, key) || "");
        const normalized = phone.replace(/[^\d+]/g, "");
        return `{tel:${normalized}}`;
      }
    );

    // Replace @{key}@ syntax
    processedContent = replaceWithRegex(
      processedContent,
      /@{(.*?)}@/g,
      /@{|}@/g,
      (key) => {
        const value = String(getNestedValue(data, key) || "");
        return processBoldSyntax(value, isLatex);
      }
    );

    // Replace #each loops in LaTeX templates
    processedContent = processedContent.replace(
      /{{#each\s+(\w+(?:\.\w+)*)}}\s*([\s\S]*?){{\/each}}/g,
      (match, arrayKey, content) => {
        const items = getNestedValue(data, arrayKey);

        if (!Array.isArray(items)) {
          return "";
        }

        return items
          .map((item) => {
            let itemContent = content.replace(/{{this}}/g, String(item));

            if (typeof item === "object" && item !== null) {
              itemContent = itemContent.replace(
                /{{(\w+)}}/g,
                (m: string, key: string) => (item[key] ? String(item[key]) : "")
              );
            }

            return itemContent;
          })
          .join("");
      }
    );
  }

  // Replace email variables in mailto: links
  processedContent = processedContent.replace(
    /href="mailto:{{(.*?)}}"/g,
    (match, key) => `href="mailto:${String(getNestedValue(data, key) || "")}"`
  );

  // Handle HTML tel: links (normalize phone numbers)
  processedContent = processedContent.replace(
    /href="tel:\{\{([^}]+)\}\}"/g,
    (match, key) => {
      const phone = String(getNestedValue(data, key) || "");
      const normalized = phone.replace(/[^\d+]/g, "");
      return `href="tel:${normalized}"`;
    }
  );

  // Replace standard variables (only if not in LaTeX mode)
  if (!isLatex) {
    processedContent = replaceWithRegex(
      processedContent,
      /{{(.*?)}}/g,
      /[{}]/g,
      (key) => {
        const value = String(getNestedValue(data, key) || "");

        // Format email addresses for spam protection (only in HTML)
        if (key.toLowerCase().includes("email")) {
          return value.replace("@", " [at] ");
        }

        return processBoldSyntax(value, isLatex);
      }
    );
  }

  // Handle includes
  processedContent = replaceWithRegex(
    processedContent,
    /<<(.*?)>>/g,
    /[<>]/g,
    (key) => {
      const nestedPath = `${basePath}/${key}`;
      const nestedIsLatex =
        isLatex ||
        nestedPath.endsWith(".tex") ||
        nestedPath.split("/").some((part) => part === "latex");

      return compile(nestedPath, data, basePath, nestedIsLatex);
    }
  );

  return processedContent;
}

/**
 * Determine if a template is a LaTeX template based on filename or path.
 * @param templatePath The template path to check.
 * @returns Boolean indicating if it's a LaTeX template.
 */
function isLatexTemplate(templatePath: string): boolean {
  return (
    templatePath.endsWith(".tex") ||
    (templatePath.includes("/") &&
      templatePath.split("/").some((part) => part === "latex"))
  );
}

/**
 * Compiles a template with the given data.
 * @param template The path to the template file or template content.
 * @param data The data to be used in the template.
 * @param basePath The base path to access other template files.
 * @param isLatex Whether to use LaTeX formatting.
 * @returns The compiled template string.
 */
export function compile(
  template: string,
  data: TemplateData,
  basePath?: string,
  isLatex: boolean = false
): string {
  basePath =
    basePath ||
    (template.includes("/") ? template.split("/").slice(0, -1).join("/") : "");

  // Determine if it's a LaTeX template if not explicitly specified
  if (!isLatex) {
    isLatex = isLatexTemplate(template);
  }

  // Check if the template is a file path or direct content
  let templateContent = template;
  if (!template.includes("<") && !template.includes("[[")) {
    templateContent = read(template);
  }

  return processContent(templateContent, data, basePath, isLatex);
}

/**
 * Replaces matches in a template string using a regex pattern.
 * @param template The string to modify.
 * @param find Regex to identify matches in the template.
 * @param extract Regex to extract keys from matches.
 * @param callback Function to generate replacement strings from keys.
 * @returns The updated template string.
 */
function replaceWithRegex(
  template: string,
  find: RegExp,
  extract: RegExp,
  callback: (matched_key: string) => string
): string {
  return template.replace(find, (match) => {
    const matched_key = match.replace(extract, "");
    return callback(matched_key);
  });
}

/**
 * Reads a file from the given path.
 * @param pathname The path to the file.
 * @returns A string containing the file content.
 */
export function read(pathname: string): string {
  try {
    return fs.readFileSync(path.resolve(__dirname, pathname), "utf8");
  } catch (e) {
    throw new Error(`Failed to read file ${pathname}`);
  }
}

/**
 * Writes a file to the given path.
 * @param pathname The path to the file.
 * @param content The content to be written to the file.
 */
export function write(pathname: string, content: string): void {
  try {
    fs.writeFileSync(path.resolve(__dirname, pathname), content);
  } catch (e) {
    throw new Error(`Failed to write file ${pathname}`);
  }
}

/**
 * Minifies the given HTML string.
 * @param html The HTML string to be minified.
 * @returns The minified HTML string.
 */
export function minifyHTML(html: string): string {
  let minified = html
    .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
    .replace(/\n\s*/g, "") // Remove newlines and leading spaces
    .replace(/>\s+</g, "><"); // Remove spaces between tags

  return minified.trim();
}
