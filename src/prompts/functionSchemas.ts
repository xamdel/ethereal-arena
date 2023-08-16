const functionSchemas = {
  generate_hand: {
    name: "generate_hand",
    description: "Generate a hand of exactly 5 cards",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "The name of the card",
              },
              effect: {
                type: "string",
                description: "The effect of the card",
              },
              energyCost: {
                type: "string",
                description: "The energy cost of the card",
              },
            },
            required: ["name", "effect", "energyCost"],
          },
          description:
            "An array of 5 cards, each with a name, effect, and energy cost",
        },
      },
      required: ["cards"],
    },
  },
  select_functions: {
    name: "select_functions",
    description:
      "Select the functions necessary to update the game state with the card's effects",
    parameters: {
      type: "object",
      properties: {
        functions: {
          type: "array",
          items: {
            type: "string",
            description:
              "Name of the function required to apply the card's effect.",
          },
          description:
            "Ordered list of function names required to interpret the card's effect.",
        },
      },
      required: ["functions"],
    },
  },
};

export default functionSchemas;