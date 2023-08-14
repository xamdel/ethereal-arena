
const functionSchemas = {
  generate_hand :{
    name: "generate_hand",
    description: "Generate a hand of 5 cards",
    parameters: {
      type: "object",
      properties: {
        cards: {
          type: "array",
          minItems: 5,
          maxItems: 5,
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
};

export default functionSchemas;