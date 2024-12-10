// ==UserScript==
// @name         Torna HTML to Dart Model Parser (Optimized)
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Parse Torna HTML and generate Dart models with improved structure and type handling
// @match        http://torna.tclpv.com/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  "use strict";

  const debug = true;

  function capitalize(text) {
    return (
      text.charAt(0).toUpperCase() +
      text.slice(1, 2).toLowerCase() +
      text.slice(2)
    );
  }

  function generateBasicClassName(segments) {
    const maxLength = 20;
    let className = "";

    // Process segments from right to left
    for (let i = segments.length - 1; i >= 0; i--) {
      let segment = segments[i];

      // console.log(">>segment", segment, i ,segments);
      // Remove method prefixes
      segment = segment.replace(/^(get|post|put|delete|patch|find|%7B)/i, "");

      // Split the segment and capitalize each word
      const words = segment.split(/[-_]/).map((word) => capitalize(word));
      // console.log(">>words", className, words);
      // Add words to the class name, respecting the max length
      for (const word of words) {
        // console.log(">>className", className.length + word.length, word + className);
        className = word + className;
      }

      // Stop if we've reached the max length
      if (className.length >= maxLength) {
        break;
      }
    }
    // Ensure the class name ends with a noun-like word
    if (
      !className.match(/(Data|Page|Info|Details|List|Collection|Set|Array)$/)
    ) {
      // const suffix = 'Model';
      // className = className.sli ce(0, maxLength - suffix.length) + suffix;
      // console.log(">>className replace", className.replace(/(Data|Page|Info|Details|List|Collection|Set|Array)$/, 'Model'));
      className = className + "Model";
    }

    return className;
  }

  function parseHtmlForClassNames(html) {
    // Create a DOMParser to parse the HTML string
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find all <li> elements
    const liElements = doc.querySelectorAll("li");

    const results = [];

    liElements.forEach((li) => {
      // Extract the URL from the text content
      const urlMatch = li.textContent.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        // Parse the URL
        const url = urlMatch[0];
        const parsedUrl = new URL(url);
        let pathname = parsedUrl.pathname.replace(/%7B([a-zA-Z]+)%7D/, "");
        // console.log(">>pathname", parsedUrl.pathname, pathname);
        // Take the last 2-3 segments for the class name
        const className = generateBasicClassName(pathname.split("/").slice(-3));

        results.push({ url, className });
      }
    });

    return results.length > 0 ? results[0]["className"] : undefined;
  }

  function findTornaResponseTable() {
    const targetText = "响应参数";
    const elements = document.body.getElementsByTagName("span");
    for (let i = 0; i < elements.length; i++) {
      if (!elements[i].innerText.includes(targetText)) {
        continue;
      }
      const parentElement = elements[i].parentElement;
      var nextSibling = parentElement.nextElementSibling;
      // 判断 nextElementSibling 是否包含 <table> 子节点
      while (!nextSibling || !nextSibling.querySelector("table"))
        nextSibling = nextSibling.nextElementSibling;
      {
        if (debug) console.log("nextElementSibling 中不包含 <table> 子节点");
      }
      if (nextSibling) {
        if (debug) console.log("table: ", nextSibling);
        return nextSibling.querySelectorAll("tr");
      }
    }
    return null;
  }

  function parseTornaHtmlToJson(baseName) {
    const tableRows = findTornaResponseTable();
    if (tableRows == null || tableRows.length <= 0) {
      return {};
    }
    const rootModel = {
      name: baseName,
      fields: [],
      type: "object",
      className: baseName,
    };
    const stack = [rootModel];
    const classMap = new Map();
    classMap.set(rootModel.className, rootModel);
    function removeCopyWithDart(element) {
      return element
        .querySelectorAll(".copyWithDart")
        .forEach((element) => element.remove());
    }
    removeCopyWithDart(document);
    function isVisible(element) {
      return window.getComputedStyle(element).display !== "none";
    }

    function getVisibleText(element) {
      let text = isVisible(element) ? element.textContent.trim() : "";
      return text.endsWith("复制") ? text.substring(0, text.length - 2) : text;
    }

    function addCopyWithDart(element) {
      let text = isVisible(element) ? element.textContent.trim() : "";
      return text.endsWith("复制") ? text.substring(0, text.length - 2) : text;
    }

    function generateClassName(name, parentName) {
      const className = name
        .split("_")
        .map((part) => capitalize(part))
        .join("");

      if (debug)
        console.log("generateClassName: ", name, parentName, className);
      return parentName + className;
    }

    for (const row of tableRows) {
      if (!isVisible(row)) continue;

      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue;

      const name = getVisibleText(cells[0]);
      const type = getVisibleText(cells[1]);
      const description = getVisibleText(cells[2]);

      if (!name || !type) continue;

      const level = parseInt(
        row.className.match(/el-table__row--level-(\d+)/)?.[1] || "0"
      );

      while (stack.length > level + 1) {
        const clz = stack.pop();
        if (clz.fields.length <= 0 && !clz.isBasicType) {
          // if (debug)
          console.log("===baseName pop: ", baseName, stack.length, level, clz);
          clz.typeStr = "List<Map>";
        }
        // baseName = clz.name;
        if (debug)
          console.log("baseName pop: ", baseName, stack.length, level, clz);
      }

      const parentClass = stack[stack.length - 1];
      const field = { name, type, description };
      if (debug) console.log("\tfield: ", name, type, description);

      if (type === "object" || type.startsWith("array")) {
        field.fields = [];
        field.className = generateClassName(name, baseName);

        if (debug)
          console.log(
            "baseName: ",
            baseName,
            type,
            field.className,
            parentClass.name
          );
        var isBasicType = false;
        if (type.startsWith("array")) {
          field.type = "array";
          const match = type.match(/array\[(\w+)\]/);
          isBasicType = match && match[1] !== "object" && match[1].length > 0;
          const subType = isBasicType
            ? getDartType({ type: match[1] })
            : field.className;
          field.typeStr = `List<${subType}>`;
          field.isBasicType = isBasicType;
        } else {
          field.typeStr = field.className;
        }

        parentClass.fields.push(field);
        stack.push(field);

        if (!classMap.has(field.className)) {
          classMap.set(field.className, field);
        }
        if (!isBasicType) {
          // 添加子模型解析按钮
          const copyButton = document.createElement("button");
          copyButton.textContent = "dart";
          copyButton.className = "copyWithDart";
          copyButton.style.marginLeft = "5px";
          copyButton.addEventListener("click", () => {
            const relatedClassMaps = getRelatedClasses(
              classMap,
              field.className
            );
            const modelCode = generateDartCode(
              classMap.get(field.className),
              relatedClassMaps
            );
            GM_setClipboard(modelCode);
            showToast(`模型${field.className}和相关类以复制!`);
          });
          cells[2].appendChild(copyButton);
        }
      } else {
        field.typeStr = getDartType(field);
        parentClass.fields.push(field);
      }
    }

    return { rootModel, classMap };
  }

  function getRelatedClasses(classMap, className) {
    const relatedClasses = new Set([className]);
    const queue = [className];
    const dependencyClassMap = new Map();
    dependencyClassMap.set(className, classMap.get(className));
    while (queue.length > 0) {
      const currentClass = queue.shift();
      const classModel = classMap.get(currentClass);

      for (const field of classModel.fields) {
        if (field.type === "object" || field.type.startsWith("array")) {
          const fieldClassName = field.className;
          if (!relatedClasses.has(fieldClassName)) {
            relatedClasses.add(fieldClassName);
            queue.push(fieldClassName);
            dependencyClassMap.set(
              fieldClassName,
              classMap.get(fieldClassName)
            );
          }
        }
      }
    }
    if (debug)
      console.log("getRelatedClasses:", className, queue, relatedClasses);
    if (debug) console.log("dependencyClassMap:", dependencyClassMap);

    // return Array.from(relatedClasses);
    return dependencyClassMap;
  }

  function optimizeClassStructure(rootModel, classMap) {
    function processField(field) {
      if (
        (field.type === "object" && field.fields.length > 0) ||
        field.type.startsWith("array[object]")
      ) {
        const existingClass = Array.from(classMap.values()).find(
          (cls) =>
            cls.className !== field.className &&
            cls.fields.length === field.fields.length &&
            cls.fields.every((f) =>
              field.fields.some(
                (ff) => ff.name === f.name && ff.type === f.type
              )
            )
        );

        if (existingClass) {
          console.log("existingClass: ", field, existingClass);
          // field.className = existingClass.className;
          // field.typeStr = existingClass.typeStr;
          // classMap.set(field.className, field);
          // } else {
          // classMap.set(field.className, field);
        }
        classMap.set(field.className, field);

        field.fields.forEach(processField);
      }
    }

    rootModel.fields.forEach(processField);
    if (debug) {
      console.log("rootModel");
      console.log(rootModel);
      console.log(classMap.keys());
      console.log(classMap);
    }
    return { rootModel, classMap };
  }

  function applyMiddlewares(rootModel, classMap, middlewares) {
    middlewares.forEach((middleware) => {
      classMap.forEach((classModel) => {
        middleware(classModel);
      });
    });
    return { rootModel, classMap };
  }

  function addCopyWithMiddleware(classModel) {
    classModel.copyWith = `
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
  }
        `;
  }

  function addFromJsonMiddleware(classModel) {
    classModel.fromJson = `
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
          return `${f.name}: ${dartType}.fromJson(json['${f.name}'])`;
        } else {
          return `${f.name}: json['${f.name}'] as ${dartType}?`;
        }
      })
      .join(",\n    ")}
  );`;
  }

  function addFromJsonWithAsMiddleware(classModel) {
    classModel.fromJson = `
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
        } else if (f.type === "object") {
          return `${f.name}: ${dartType}.fromJson(json.getAsMap('${f.name}'))`;
        }
        return `${f.name}: json.getAs${capitalize(dartType)}('${f.name}')`;
      })
      .join(",\n    ")}
  );`;
  }

  function addToJsonMiddleware(classModel) {
    classModel.toJson = `
  Map<String, dynamic> toJson() => {
    ${classModel.fields
      .map((f) => {
        const dartType = getDartType(f);
        if (f.type == "array[object]") {
          return `'${f.name}': ${f.name}?.map((e) => e.toJson()).toList()`;
        } else {
          return `'${f.name}': ${f.name}`;
        }
      })
      .join(",\n    ")}
  };`;
  }

  function generateDartCode(rootModel, classMap) {
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

      dartCode += `  ${classModel.className}({\n`;
      classModel.fields.forEach((field) => {
        dartCode += `    this.${field.name},\n`;
      });
      dartCode += `  });\n`;
      dartCode += "\n";

      dartCode += classModel.fromJson;
      dartCode += "\n";
      dartCode += classModel.toJson;
      dartCode += "\n";
      dartCode += classModel.copyWith;

      dartCode += `}\n\n`;
    }

    Array.from(classMap.values()).forEach(generateClass);

    return dartCode;
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
        if (debug) console.log("getGenericType", type, typeStr, match);
        if (match) return match[1];
      }
      if (type.startsWith("array")) {
        const match = type.match(/array\[(\w+)\]/);
        return match ? match[1] : "dynamic";
      }
    }
    return type;
  }

  function showToast(message, duration = 3000) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    toast.style.color = "white";
    toast.style.padding = "10px 20px";
    toast.style.borderRadius = "5px";
    toast.style.zIndex = "10000";

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  function promptForModelName() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.position = "fixed";
      modal.style.top = "0";
      modal.style.left = "0";
      modal.style.width = "100%";
      modal.style.height = "100%";
      modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      modal.style.display = "flex";
      modal.style.justifyContent = "center";
      modal.style.alignItems = "center";
      modal.style.zIndex = "10001";

      const content = document.createElement("div");
      content.style.backgroundColor = "white";
      content.style.padding = "20px";
      content.style.borderRadius = "5px";

      const input = document.createElement("input");
      input.type = "text";
      input.value = "TornaResponse";
      input.placeholder = "输入生成类名";
      input.style.marginBottom = "10px";
      input.style.width = "100%";
      input.style.padding = "5px";

      const submitButton = document.createElement("button");
      submitButton.textContent = "Submit";
      submitButton.style.marginRight = "10px";

      const cancelButton = document.createElement("button");
      cancelButton.textContent = "Cancel";

      content.appendChild(input);
      content.appendChild(submitButton);
      content.appendChild(cancelButton);
      modal.appendChild(content);

      submitButton.addEventListener("click", () => {
        const modelName = input.value.trim();
        if (modelName) {
          modal.remove();
          resolve(modelName);
        } else {
          showToast("Please enter a model name");
        }
      });

      cancelButton.addEventListener("click", () => {
        modal.remove();
        resolve(null);
      });

      document.body.appendChild(modal);
      input.focus();
    });
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

  const middlewares = [
    addCopyWithMiddleware,
    addFromJsonMiddleware,
    addToJsonMiddleware,
  ];
  const middlewaresWithAs = [
    addCopyWithMiddleware,
    addFromJsonWithAsMiddleware,
    addToJsonMiddleware,
  ];
  function addParseButton() {
    const parseButton = document.createElement("button");
    parseButton.textContent = "响应Dart";
    parseButton.style.position = "fixed";
    parseButton.style.top = "40vh";
    parseButton.style.right = "20px";
    parseButton.style.zIndex = "1000";
    parseButton.style.padding = "10px 15px";
    parseButton.style.backgroundColor = "#4CAF50";
    parseButton.style.color = "white";
    parseButton.style.border = "none";
    parseButton.style.borderRadius = "5px";
    parseButton.style.cursor = "pointer";

    parseButton.addEventListener("click", async () => {
      var modelName = parseHtmlForClassNames(document.body.innerHTML);
      console.log("modelName", modelName);
      if (modelName == undefined) {
        modelName = await promptForModelName();
        if (!modelName) return;
      }

      const { rootModel, classMap } = parseTornaHtmlToJson(modelName);
      console.log("classMap", classMap);
      if (classMap && classMap.size > 1) {
        rootModel.name = modelName;
        rootModel.className = modelName;
        const optimizedStructure = optimizeClassStructure(rootModel, classMap);
        const processedStructure = applyMiddlewares(
          optimizedStructure.rootModel,
          optimizedStructure.classMap,
          middlewares
        );
        let dartCode = generateDartCode(
          processedStructure.rootModel,
          processedStructure.classMap
        );
        dartCode = formatDartCode(dartCode);
        console.log(dartCode);
        GM_setClipboard(dartCode);
        showToast("Dart model generated and copied to clipboard!");
      } else {
        showToast("No valid response definition found.");
      }
    });
    document.body.appendChild(parseButton);
  }
  function addParseAsButton() {
    const parseButton = document.createElement("button");
    parseButton.textContent = "响应Dart As";
    parseButton.style.position = "fixed";
    parseButton.style.top = "35vh";
    parseButton.style.right = "20px";
    parseButton.style.zIndex = "1000";
    parseButton.style.padding = "5px 10px";
    parseButton.style.backgroundColor = "#4CAF50";
    parseButton.style.color = "white";
    parseButton.style.border = "none";
    parseButton.style.borderRadius = "15px";
    parseButton.style.cursor = "pointer";

    parseButton.addEventListener("click", async () => {
      var modelName = parseHtmlForClassNames(document.body.innerHTML);
      console.log("modelName", modelName);
      if (modelName == undefined) {
        modelName = await promptForModelName();
        if (!modelName) return;
      }

      const { rootModel, classMap } = parseTornaHtmlToJson(modelName);
      console.log("classMap", classMap);
      if (classMap && classMap.size > 1) {
        rootModel.name = modelName;
        rootModel.className = modelName;
        const optimizedStructure = optimizeClassStructure(rootModel, classMap);
        const processedStructure = applyMiddlewares(
          optimizedStructure.rootModel,
          optimizedStructure.classMap,
          middlewaresWithAs
        );
        let dartCode = generateDartCode(
          processedStructure.rootModel,
          processedStructure.classMap
        );
        dartCode = formatDartCode(dartCode);
        console.log(dartCode);
        GM_setClipboard(dartCode);
        showToast("Dart model generated and copied to clipboard!");
      } else {
        showToast("No valid response definition found.");
      }
    });
    document.body.appendChild(parseButton);
  }

  addParseButton();
  addParseAsButton();
})();
