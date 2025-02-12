import fs from "fs";
import path from "path";

/**
 * Compiles an html template with the given data.
 * @param template The path to the template file.
 * @param data The data to be used in the template.
 */
export function compile(template: string, data: object) {
  let component = read(template);

  if (!component) throw new Error(`Failed to read template ${template}`);

  // replace all the {{key}} with the data
  const keys_regex = /{{(.*?)}}/g;
  const keys = component.match(keys_regex) ?? [];

  for (const key of keys) {
    const key_name = key.replace(/[{}]/g, "");

    const value = key_name
      .split(".")
      .reduce((acc, part) => acc && (acc as any)[part], data);

    if (value !== undefined) {
      component = component.replace(key, String(value));
    }
  }

  // recursively replace the <<tag>> with the compiled version
  const tags_regex = /<<(.*?)>>/g;
  let match;

  while ((match = tags_regex.exec(component)) !== null) {
    const tag = match[0];
    const tag_name = match[1];

    const compiled_tag = compile(`templates/${tag_name}`, data);

    if (compiled_tag !== undefined) {
      component = component.replace(tag, compiled_tag);
    }
  }

  return component;
}

/**
 * Reads a file from the given path.
 * @param pathname The path to the file.
 */
export function read(pathname: string) {
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
export function write(pathname: string, content: string) {
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
  // Remove HTML comments
  let minified = html.replace(/<!--[\s\S]*?-->/g, "");

  // Remove redundant whitespace
  minified = minified.replace(/\s{2,}/g, " "); // Replace multiple spaces with a single space
  minified = minified.replace(/\n\s*/g, ""); // Remove newlines and leading spaces

  // Remove spaces between tags
  minified = minified.replace(/>\s+</g, "><");

  // Trim the final result
  return minified.trim();
}
