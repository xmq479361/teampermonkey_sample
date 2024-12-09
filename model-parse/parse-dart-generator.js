// ==UserScript==
// @name         parse-dart-generator.js
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  Dart code generation for multi-source HTML to Dart Parser
// @match        http://torna.tclpv.com/*
// @match        https://apifox.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @require      https://raw.githubusercontent.com/xmq479361/teampermonkey_sample/refs/heads/main/model-parse/parse-model-core.js?t=4
// ==/UserScript==

(function () {
  "use strict";

  function generateDartCode(classMap, useAsKeyword = false) {
    let dartCode = "";

    function generateClass(classModel) {
      if (classModel.fields.length <= 0) return;
      dartCode += `class ${classModel.className} {\n`;

      classModel.fields.forEach((field) => {
        const dartType = getDartType(field);
        dartCode += `  /// ${field.description
          .split("\n")
          .join("\n  /// ")}\n  ${dartType}? ${field.name};\n`;
      });

      dartCode += `\n  ${classModel.className}({\n`;
      classModel.fields.forEach((field) => {
        dartCode += `    this.${field.name},\n`;
      });
      dartCode += `  });\n\n`;

      dartCode += generateFromJson(classModel, useAsKeyword);
      dartCode += "\n";
      dartCode += generateToJson(classModel);
      dartCode += "\n";
      dartCode += generateCopyWith(classModel);

      dartCode += `}\n\n`;
    }

    Array.from(classMap.values()).forEach(generateClass);

    return dartCode;
  }

  function generateFromJson(classModel, useAsKeyword) {
    return `
factory ${classModel.className}.fromJson(Map<String, dynamic> json) => ${
      classModel.className
    }(
  ${classModel.fields
    .map((f) => {
      const dartType = getDartType(f);
      if (f.type === "array[object]") {
        return `${f.name}: (json['${
          f.name
        }'] as List<dynamic>?)?.map((e) => ${getGenericType(
          f
        )}.fromJson(e as Map<String, dynamic>)).toList() ?? []`;
      } else if (dartType.startsWith("List")) {
        const subType = getGenericType(f);
        return `${f.name}: (json['${f.name}'] as List<dynamic>?)?.map((e) => e as ${subType}).toList() ?? []`;
      } else if (f.type === "object") {
        return useAsKeyword
          ? `${f.name}: ${dartType}.fromJson(json.getAsMap('${f.name}'))`
          : `${f.name}: ${dartType}.fromJson(json['${f.name}'] as Map<String, dynamic>)`;
      } else {
        return useAsKeyword
          ? `${f.name}: json.getAs${window.parser.capitalize(dartType)}('${
              f.name
            }')`
          : `${f.name}: json['${f.name}'] as ${dartType}?`;
      }
    })
    .join(",\n    ")}
);`;
  }

  function generateToJson(classModel) {
    return `
Map<String, dynamic> toJson() => {
  ${classModel.fields
    .map((f) => {
      const dartType = getDartType(f);
      if (f.type == "array[object]") {
        return `'${f.name}': ${f.name}?.map((e) => e.toJson()).toList()`;
      } else if (f.type === "object") {
        return `'${f.name}': ${f.name}?.toJson() ?? {}`;
      } else {
        return `'${f.name}': ${f.name}`;
      }
    })
    .join(",\n    ")}
};`;
  }

  function generateCopyWith(classModel) {
    return `
${classModel.className} copyWith({
  ${classModel.fields
    .map((f) => `${getDartType(f)}? ${f.name}`)
    .join(",\n    ")}
}) {
  return ${classModel.className}(
    ${classModel.fields
      .map((f) => `${f.name}: ${f.name} ?? this.${f.name}`)
      .join(",\n      ")}
  );
}\n`;
  }

  function formatDartCode(code) {
    const lines = code.split("\n");
    let indentLevel = 0;
    const formattedLines = lines.map((line) => {
      line = line.trim();
      if (line.endsWith("{")) {
        const indentedLine = "  ".repeat(indentLevel) + line;
        indentLevel++;
        return indentedLine;
      } else if (line.startsWith("}")) {
        indentLevel = Math.max(0, indentLevel - 1);
        return "  ".repeat(indentLevel) + line;
      } else {
        return "  ".repeat(indentLevel) + line;
      }
    });
    return formattedLines.join("\n");
  }

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

  function getGenericType(f) {
    const { type, typeStr } = f;
    if (type.startsWith("array") || (typeStr && typeStr.startsWith("List"))) {
      if (typeStr) {
        const match = typeStr.match(/List<(\w+)>/);
        if (match) return match[1];
      }
      if (type.startsWith("array")) {
        const match = type.match(/array\[(\w+)\]/);
        return match ? match[1] : "dynamic";
      }
    }
    return type;
  }

  // Export functions to be used by other scripts
  window.dartGenerator = {
    generateDartCode,
    formatDartCode,
  };

  // Add button to generate and copy Dart code
  // function addGenerateDartButton(text, top, useAsKeyword = false) {
  //   const button = document.createElement("button");
  //   button.textContent = text;
  //   button.className = "parser-button";
  //   button.style.top = top;
  //   button.addEventListener("click", () => {
  //     const parsedDataString = GM_getValue("parsedData");
  //     if (parsedDataString) {
  //       const parsedData = JSON.parse(parsedDataString);
  //       const dartCode = generateDartCode(parsedData.classMap, useAsKeyword);
  //       const formattedCode = formatDartCode(dartCode);
  //       GM_setClipboard(formattedCode);
  //       alert("Dart code generated and copied to clipboard!");
  //     } else {
  //       alert("No parsed data found. Please parse data first.");
  //     }
  //   });
  //   document.body.appendChild(button);
  // }

  // addGenerateDartButton("Generate Dart", "45vh");
  // addGenerateDartButton('Generate Dart (with "as")', "50vh", true);
})();

// For demonstration purposes, let's generate some sample Dart code
const sampleClassMap = new Map([
  [
    "UserModel",
    {
      className: "UserModel",
      fields: [
        { name: "id", type: "integer", description: "User ID" },
        { name: "name", type: "string", description: "User name" },
        { name: "email", type: "string", description: "User email" },
        {
          name: "addresses",
          type: "array[object]",
          description: "User addresses",
          className: "AddressModel",
        },
      ],
    },
  ],
  [
    "AddressModel",
    {
      className: "AddressModel",
      fields: [
        { name: "street", type: "string", description: "Street name" },
        { name: "city", type: "string", description: "City name" },
      ],
    },
  ],
]);

const generatedCode = window.dartGenerator.generateDartCode(sampleClassMap);
const formattedCode = window.dartGenerator.formatDartCode(generatedCode);
console.log("Generated Dart code:");
console.log(formattedCode);
