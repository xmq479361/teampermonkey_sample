// ==UserScript==
// @name         parse-ui.js
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  UI components for multi-source HTML to Dart Parser
// @match        http://torna.tclpv.com/*
// @match        https://apifox.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @require      https://raw.githubusercontent.com/xmq479361/teampermonkey_sample/refs/heads/main/model-parse/parse-model-core.js?t=4
// @require      https://raw.githubusercontent.com/xmq479361/teampermonkey_sample/refs/heads/main/model-parse/parse-dart-generator.js?t=4
// ==/UserScript==

(function () {
  "use strict";

  GM_addStyle(`
      .parser-button {
          position: fixed;
          right: 20px;
          z-index: 1000;
          padding: 5px 10px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 15px;
          cursor: pointer;
          margin-bottom: 10px;
      }
      .parser-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          z-index: 10000;
      }
  `);

  function showToast(message, duration = 3000) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.className = "parser-toast";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function promptForModelName() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background-color: rgba(0, 0, 0, 0.5);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 10001;
          `;

      const content = document.createElement("div");
      content.style.cssText = `
              background-color: white;
              padding: 20px;
              border-radius: 5px;
          `;

      const input = document.createElement("input");
      input.type = "text";
      input.value = "ResponseModel";
      input.placeholder = "Enter class name";
      input.style.cssText = `
              margin-bottom: 10px;
              width: 100%;
              padding: 5px;
          `;

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

  function addParseButton(text, top, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.className = "parser-button";
    button.style.top = top;
    button.addEventListener("click", onClick);
    document.body.appendChild(button);
  }

  // Add UI buttons
  addParseButton("Generate Dart", "40vh", async () => {
    const jsonString = GM_getValue("parsedData");
    if (jsonString) {
      console.log(jsonString);
      const classMap = new Map(JSON.parse(jsonString));
      const generatedCode = window.dartGenerator.generateDartCode(classMap);
      const formattedCode = window.dartGenerator.formatDartCode(generatedCode);
      console.log(formattedCode);
      GM_setClipboard(formattedCode);
      showToast("Dart model generated and copied to clipboard!");
    } else {
      showToast("No valid data found. Please parse data first.");
    }
  });

  addParseButton('Generate Dart (with "as")', "35vh", async () => {
    const jsonString = GM_getValue("parsedData");
    if (jsonString) {
      console.log(jsonString);
      const classMap = new Map(JSON.parse(jsonString));
      const generatedCode = window.dartGenerator.generateDartCode(
        classMap,
        true
      );
      const formattedCode = window.dartGenerator.formatDartCode(generatedCode);
      console.log(formattedCode);
      GM_setClipboard(formattedCode);
      showToast(
        'Dart model (with "as" syntax) generated and copied to clipboard!'
      );
    } else {
      showToast("No valid data found. Please parse data first.");
    }
  });

  // Add site-specific buttons
  const currentURL = window.location.href;
  if (currentURL.includes("torna.tclpv.com")) {
    addParseButton("Parse Torna", "30vh", () => {
      const parser = window.parser.createParser("torna");
      const { rootModel, classMap } = parser.parse(document.body.innerHTML);
      const classMapArrayJson = JSON.stringify(Array.from(classMap));
      console.log(classMapArrayJson);
      GM_setValue("parsedData", classMapArrayJson);
      const generatedCode = window.dartGenerator.generateDartCode(classMap);
      const formattedCode = window.dartGenerator.formatDartCode(generatedCode);
      console.log(formattedCode);
      GM_setClipboard(formattedCode);
      showToast("Torna data parsed successfully!");
    });
  } else if (currentURL.includes("apifox.com")) {
    addParseButton("Parse Apifox", "30vh", () => {
      const parser = window.parser.createParser("apifox");
      // Implement Apifox-specific parsing logic here
      showToast("Apifox parsing not yet implemented");
    });
  }

  // Add clipboard parsing buttons
  addParseButton("Parse JSON from Clipboard", "25vh", async () => {
    const clipboardText = await navigator.clipboard.readText();
    const parser = window.parser.createParser("json");
    const { rootModel, classMap } = parser.parse(clipboardText);
    console.log(classMap);

    const generatedCode = window.dartGenerator.generateDartCode(classMap);
    const formattedCode = window.dartGenerator.formatDartCode(generatedCode);
    console.log(formattedCode);
    GM_setClipboard(formattedCode);
    showToast("JSON parsed from clipboard successfully!");
  });

  addParseButton("Parse Dart from Clipboard", "20vh", async () => {
    const clipboardText = await navigator.clipboard.readText();
    const parser = window.parser.createParser("dart");
    const { rootModel, classMap } = parser.parse(clipboardText);
    console.log(classMap);
    const generatedCode = window.dartGenerator.generateDartCode(classMap);
    const formattedCode = window.dartGenerator.formatDartCode(generatedCode);
    console.log(formattedCode);
    GM_setClipboard(formattedCode);
    showToast("Dart class parsed from clipboard successfully!");
  });
})();

console.log("UI components added to the page");
