// gemini-api.js
// Handles communication with Gemini 2.5 Flash for automatic affinity grouping

window.geminiService = {
  /**
   * Performs automatic KJ affinity grouping on a list of cards using Gemini 2.5 Flash
   * @param {Array} cards - The list of cards to group
   * @returns {Promise<Object>} Object containing grouped cards and independent cards
   */
  async classifyCards(cards) {
    const apiKey = localStorage.getItem("KJ_GEMINI_API_KEY") || 
                   (window.SYSTEM_CONFIG ? window.SYSTEM_CONFIG.GEMINI_API_KEY : null);
    const isValidKey = apiKey && apiKey !== "" && !apiKey.startsWith("YOUR_");
    
    if (!isValidKey) {
      throw new Error("API_KEY_MISSING");
    }

    if (!cards || cards.length < 3) {
      throw new Error("INSUFFICIENT_CARDS");
    }

    // Format card data for the model
    const cardsFormatted = cards.map(c => ({
      id: c.id,
      text: c.text
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const promptText = `
你是一位精通「KJ 親和圖法」（Affinity Diagram）的腦力激盪專家。
請閱讀以下提供的卡片列表，並根據卡片內容的本質關聯性、語意相關度或共同屬性進行「親和歸類」：

卡片列表：
${JSON.stringify(cardsFormatted, null, 2)}

【歸類規則】：
1. 你的任務是將這些卡片分組（Groups），將相關的想法聚攏。
2. 每組（Group）**必須強制作為 2 張或以上的卡片**（即 cardIds 陣列長度必須大於等於 2）。如果某個分類只有 1 張卡片，請將該卡片歸類為「獨立卡片」。
3. 針對每個分組，請提煉出一個精準、清晰的「中文群組標籤（短語）」，作為該組 the name（例如："技術研發"、"客戶服務"、"流程優化"），長度控制在 8 個中文字以內。
4. 如果某張卡片與其他所有卡片均無顯著的內在本質關聯，請將該卡片的 ID 放入「獨立卡片區」（independentCardIds）。
5. 你必須使用傳入的原始卡片 ID，不能遺漏 any card，也不能憑空創造新的卡片 ID。
6. 請完全以繁體中文 (Traditional Chinese) 回傳結果。
`;

    // Define JSON schema for Gemini output
    const responseSchema = {
      type: "OBJECT",
      properties: {
        groups: {
          type: "ARRAY",
          description: "分類好的群組列表，每個群組代表一個高度關聯的卡片類別，每個群組必須包含至少兩張卡片。",
          items: {
            type: "OBJECT",
            properties: {
              name: {
                type: "STRING",
                description: "精準的中文群組標籤（短語，不超過 8 個繁體中文字），代表該群組想法的核心本質。"
              },
              cardIds: {
                type: "ARRAY",
                items: {
                  type: "STRING"
                },
                description: "該群組包含的卡片 ID 列表。"
              }
            },
            required: ["name", "cardIds"]
          }
        },
        independentCardIds: {
          type: "ARRAY",
          items: {
            type: "STRING"
          },
          description: "與其他卡片沒有強烈關聯的獨立卡片 ID 列表。這些卡片會被放入獨立卡片區。"
        }
      },
      required: ["groups", "independentCardIds"]
    };

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: promptText
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2
      }
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Gemini API Error Response:", errText);
        
        if (response.status === 400 && errText.includes("API key")) {
          throw new Error("API_KEY_INVALID");
        }
        if (response.status === 403 && errText.includes("leaked")) {
          throw new Error("API_KEY_LEAKED");
        }
        throw new Error(`API_REQUEST_FAILED: ${response.status}`);
      }

      const resData = await response.json();
      
      if (!resData.candidates || resData.candidates.length === 0) {
        throw new Error("API_NO_CANDIDATES");
      }

      const contentText = resData.candidates[0].content.parts[0].text;
      const parsedResult = JSON.parse(contentText);

      return parsedResult;

    } catch (error) {
      console.error("Gemini API Request failed:", error);
      throw error;
    }
  }
};
