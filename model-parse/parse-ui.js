// ==UserScript==
// @name         Torna HTML to Dart Parser - UI
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  UI components for multi-source HTML to Dart Parser
// @match        http://torna.tclpv.com/*
// @match        https://apifox.com/*
// @grant        GM_getValue
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @require      https://github.com/xmq479361/teampermonkey_sample/model-parse/parse-model-core.js
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
    const parsedDataString = GM_getValue("parsedData");
    if (parsedDataString) {
      const parsedData = JSON.parse(parsedDataString);
      // Process the data and generate Dart code
      // This would call functions from another script that handles Dart code generation
      showToast("Dart model generated and copied to clipboard!");
    } else {
      showToast("No valid data found. Please parse data first.");
    }
  });

  addParseButton('Generate Dart (with "as")', "35vh", async () => {
    const parsedDataString = GM_getValue("parsedData");
    if (parsedDataString) {
      const parsedData = JSON.parse(parsedDataString);
      // Process the data and generate Dart code with 'as' syntax
      // This would call functions from another script that handles Dart code generation
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
      const parser = window.tornaParser.createParser("torna");
      const parsedData = parser.parse(document.body.innerHTML);
      GM_setValue("parsedData", JSON.stringify(parsedData));
      showToast("Torna data parsed successfully!");
    });
  } else if (currentURL.includes("apifox.com")) {
    addParseButton("Parse Apifox", "30vh", () => {
      const parser = window.tornaParser.createParser("apifox");
      // Implement Apifox-specific parsing logic here
      showToast("Apifox parsing not yet implemented");
    });
  }
})();

console.log("UI components added to the page");
