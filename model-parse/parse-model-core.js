// ==UserScript==
// @name         parse-model-core.js
// @namespace    http://tampermonkey.net/
// @version      0.7
// @description  Core functionality for parsing various data sources and generating Dart models
// @match        http://torna.tclpv.com/*
// @match        https://apifox.com/*
// ==/UserScript==

(function () {
  "use strict";

  const debug = false;

  // Utility functions
  const capitalize = (text) =>
    text.charAt(0).toUpperCase() +
    text.slice(1, 2).toLowerCase() +
    text.slice(2);

  function generateBasicClassName(segments) {
    const maxLength = 20;
    let className = "";

    // Process segments from right to left
    for (let i = segments.length - 1; i >= 0; i--) {
      let segment = segments[i].replace(
        /^(get|post|put|delete|patch|find|%7B)/i,
        ""
      );
      const words = segment.split(/[-_]/).map((word) => capitalize(word));
      for (const word of words) {
        className = word + className;
      }
      if (className.length >= maxLength) {
        break;
      }
    }
    if (
      !className.match(/(Data|Page|Info|Details|List|Collection|Set|Array)$/)
    ) {
      className = className + "Model";
    }
    return className;
  }

  // Parser interface
  class Parser {
    parse(input) {
      throw new Error("parse method must be implemented");
    }
  }

  // Torna HTML Parser
  class TornaHTMLParser extends Parser {
    parse(html) {
      const modelName = this.parseHtmlForClassNames(html);
      return this.parseTornaHtmlToJson(modelName);
    }

    parseHtmlForClassNames(html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const liElements = doc.querySelectorAll("li");

      for (const li of liElements) {
        const urlMatch = li.textContent.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
          const url = new URL(urlMatch[0]);
          const pathname = url.pathname.replace(/%7B([a-zA-Z]+)%7D/, "");
          return generateBasicClassName(pathname.split("/").slice(-3));
        }
      }
    }

    parseTornaHtmlToJson(baseName) {
      const tableRows = this.findTornaResponseTable();
      if (!tableRows || tableRows.length === 0) return {};

      const rootModel = {
        name: baseName,
        fields: [],
        type: "object",
        className: baseName,
      };
      const stack = [rootModel];
      const classMap = new Map([[rootModel.className, rootModel]]);

      const isVisible = (element) =>
        window.getComputedStyle(element).display !== "none";
      const getVisibleText = (element) => {
        const text = isVisible(element) ? element.textContent.trim() : "";
        return text.endsWith("复制") ? text.slice(0, -2) : text;
      };

      for (const row of tableRows) {
        if (!isVisible(row)) continue;

        const cells = row.querySelectorAll("td");
        if (cells.length < 3) continue;

        const [name, type, description] = [cells[0], cells[1], cells[2]].map(
          getVisibleText
        );
        if (!name || !type) continue;

        const level = parseInt(
          row.className.match(/el-table__row--level-(\d+)/)?.[1] || "0"
        );

        while (stack.length > level + 1) {
          const popped = stack.pop();
          if (popped.fields.length === 0 && !popped.isBasicType) {
            popped.typeStr = "List<Map>";
          }
        }

        const parentClass = stack[stack.length - 1];
        const field = { name, type, description };

        if (type === "object" || type.startsWith("array")) {
          field.fields = [];
          field.className = generateClassName([name, baseName]);

          const isBasicType =
            type.startsWith("array") &&
            type.match(/array\[(\w+)\]/) &&
            type.match(/array\[(\w+)\]/)[1] !== "object";
          field.type = type.startsWith("array") ? "array" : type;
          field.typeStr = type.startsWith("array")
            ? `List<${
                isBasicType
                  ? getDartType({ type: type.match(/array\[(\w+)\]/)[1] })
                  : field.className
              }>`
            : field.className;
          field.isBasicType = isBasicType;

          parentClass.fields.push(field);
          stack.push(field);
          classMap.set(field.className, field);
        } else {
          field.typeStr = getDartType(field);
          parentClass.fields.push(field);
        }
      }

      return { rootModel, classMap };
    }

    findTornaResponseTable() {
      const targetText = "响应参数";
      const spans = document.body.getElementsByTagName("span");
      for (const span of spans) {
        if (span.innerText.includes(targetText)) {
          let nextSibling = span.parentElement.nextElementSibling;
          while (nextSibling && !nextSibling.querySelector("table")) {
            nextSibling = nextSibling.nextElementSibling;
          }
          if (nextSibling) {
            return nextSibling.querySelectorAll("tr");
          }
        }
      }
      return null;
    }
  }

  // Apifox Parser
  class ApifoxParser extends Parser {
    parse(data) {
      // Implement Apifox parsing logic here
      // This is a placeholder and should be replaced with actual implementation
      return { rootModel: {}, classMap: new Map() };
    }
  }

  // JSON Parser
  class JSONParser extends Parser {
    parse(jsonString) {
      try {
        const data = JSON.parse(jsonString);
        return this.convertJsonToModel(data);
      } catch (error) {
        console.error("Failed to parse JSON:", error);
        return { rootModel: {}, classMap: new Map() };
      }
    }

    convertJsonToModel(data, className = "RootModel") {
      const rootModel = {
        name: className,
        fields: [],
        type: "object",
        className,
      };
      const classMap = new Map();

      for (const [key, value] of Object.entries(data)) {
        const field = { name: key, type: this.getType(value), description: "" };

        if (field.type === "object") {
          field.className = `${capitalize(key)}Model`;
          field.fields = [];
          const { rootModel: subModel, classMap: subClassMap } =
            this.convertJsonToModel(value, field.className);
          field.fields = subModel.fields;
          classMap.set(field.className, field);
          subClassMap.forEach((value, key) => classMap.set(key, value));
        } else if (field.type === "array" && typeof value[0] === "object") {
          field.className = `${capitalize(key)}Model`;
          field.fields = [];
          const { rootModel: subModel, classMap: subClassMap } =
            this.convertJsonToModel(value[0], field.className);
          field.fields = subModel.fields;
          classMap.set(field.className, field);
          subClassMap.forEach((value, key) => classMap.set(key, value));
        }

        rootModel.fields.push(field);
      }

      classMap.set(className, rootModel);
      return { rootModel, classMap };
    }

    getType(value) {
      if (Array.isArray(value)) return "array";
      if (value === null) return "null";
      return typeof value;
    }
  }

  // Dart Class Parser
  class DartClassParser extends Parser {
    parse(dartCode) {
      const classes = this.extractClasses(dartCode);
      const classMap = new Map();

      classes.forEach((cls) => {
        const { className, fields } = this.parseClass(cls);
        classMap.set(className, {
          name: className,
          className: className,
          fields: fields,
          type: "object",
        });
      });

      const rootModel = classMap.values().next().value;
      return { rootModel, classMap };
    }

    extractClasses(dartCode) {
      const classRegex = /class\s+(\w+)\s*{[\s\S]*?}/g;
      return dartCode.match(classRegex) || [];
    }

    parseClass(classCode) {
      const classNameMatch = classCode.match(/class\s+(\w+)/);
      const className = classNameMatch ? classNameMatch[1] : "UnknownClass";

      const fieldRegex = /(\w+)\??(\s+\w+)?\s+(\w+);/g;
      const fields = [];
      let match;

      while ((match = fieldRegex.exec(classCode)) !== null) {
        const type = match[2] ? match[2].trim() : match[1];
        const name = match[3];
        fields.push({
          name: name,
          type: this.mapDartTypeToJsonType(type),
          typeStr: type,
          description: "",
        });
      }

      return { className, fields };
    }

    mapDartTypeToJsonType(dartType) {
      const typeMap = {
        int: "integer",
        double: "number",
        String: "string",
        bool: "boolean",
        List: "array",
        Map: "object",
      };

      return typeMap[dartType] || "object";
    }
  }

  // Parser factory
  const createParser = (type) => {
    switch (type) {
      case "torna":
        return new TornaHTMLParser();
      case "apifox":
        return new ApifoxParser();
      case "json":
        return new JSONParser();
      case "dart":
        return new DartClassParser();
      default:
        throw new Error(`Unsupported parser type: ${type}`);
    }
  };

  // Export functions and classes to be used by other scripts
  window.parser = {
    createParser,
    generateClassName,
    capitalize,
  };

  // Store parsed data for other scripts to use
  // GM_setValue("parsedData", null);

  // // Parse and store data when the page loads
  // const currentURL = window.location.href;
  // if (currentURL.includes("torna.tclpv.com")) {
  //   const parser = createParser("torna");
  //   const parsedData = parser.parse(document.body.innerHTML);
  //   GM_setValue("parsedData", JSON.stringify(parsedData));
  // } else if (currentURL.includes("apifox.com")) {
  //   // Implement Apifox-specific parsing logic here
  // }

  // // Add menu commands for parsing from clipboard
  // GM_registerMenuCommand("Parse JSON from clipboard", async () => {
  //   const clipboardText = await navigator.clipboard.readText();
  //   const parser = createParser("json");
  //   const parsedData = parser.parse(clipboardText);
  //   GM_setValue("parsedData", JSON.stringify(parsedData));
  //   alert("JSON parsed from clipboard");
  // });

  // GM_registerMenuCommand("Parse Dart class from clipboard", async () => {
  //   const clipboardText = await navigator.clipboard.readText();
  //   const parser = createParser("dart");
  //   const parsedData = parser.parse(clipboardText);
  //   GM_setValue("parsedData", JSON.stringify(parsedData));
  //   alert("Dart class parsed from clipboard");
  // });
})();

function getDartType(f) {
  const { type, typeStr, fields } = f;
  switch (type.toLowerCase()) {
    case "integer":
      return "int";
    case "number":
      return "double";
    case "boolean":
      return "bool";
    case "array":
    case "array[object]":
      return typeStr || "List";
    case "object":
      return fields && fields.length > 0 ? typeStr : "Map<String, dynamic>";
    default:
      return "String";
  }
}

// For demonstration purposes, let's simulate parsing different data sources
// const tornaParser = window.parser.createParser("torna");
// const jsonParser = window.parser.createParser("json");
// const dartParser = window.parser.createParser("dart");

// const sampleHtml = `
// <ul>
//   <li>http://api.example.com/users/getProfile</li>
// </ul>
// <table>
//   <tr class="el-table__row--level-0">
//       <td>data</td>
//       <td>object</td>
//       <td>User data</td>
//   </tr>
//   <tr class="el-table__row--level-1">
//       <td>id</td>
//       <td>integer</td>
//       <td>User ID</td>
//   </tr>
//   <tr class="el-table__row--level-1">
//       <td>name</td>
//       <td>string</td>
//       <td>User name</td>
//   </tr>
// </table>
// `;

// const sampleJson = `
// {
//   "user": {
//       "id": 1,
//       "name": "John Doe",
//       "email": "john@example.com",
//       "addresses": [
//           {
//               "street": "123 Main St",
//               "city": "Anytown"
//           }
//       ]
//   }
// }
// `;

// const sampleDartClass = `
// class User {
// int? id;
// String? name;
// String? email;
// List<Address>? addresses;
// }

// class Address {
// String? street;
// String? city;
// }
// `;

// console.log("Parsed Torna HTML:", tornaParser.parse(sampleHtml));
// console.log("Parsed JSON:", jsonParser.parse(sampleJson));
// console.log("Parsed Dart class:", dartParser.parse(sampleDartClass));
