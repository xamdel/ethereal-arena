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
                type: "number",
                description: "The energy cost of the card (1-4)",
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
  }, //NOTE: attempting to group state change functions by their relevant arguments; may get better results from the GLI by using a specific schema for each state change function
  add_remove_health_energy: {
    name: "add_remove_health_energy",
    description:
      "Provide target and amount for adding or removing health or energy.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target (self/opponent) for the operation.",
        },
        value: {
          type: "number",
          description: "Numeric value for the operation.",
        },
      },
      required: ["target", "value"],
    },
  },
  remove_buff_debuff: {
    name: "remove_buff_debuff",
    description: "Remove specified buff(s) or debuff(s).",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target (self/opponent) for the operation.", //TODO: account for edge case: card effects targeting both
        },
        names: {
          type: "array",
          items: { type: "string" },
          description: "Names of the buffs/debuffs to be removed.",
        },
      },
      required: ["target", "names"],
    },
  },
  add_buff_debuff: {
    name: "add_buff_debuff",
    description: "Add specified buff or debuff with details.",
    parameters: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Target (self/opponent) for the operation.",
        },
        name: {
          type: "string",
          description: "Name/title of the buff/debuff.",
        },
        description: {
          type: "string",
          description: "Short description of the effect.",
        },
        duration: {
          type: "number",
          description: "Duration of the effect in turns.",
        },
      },
      required: ["target", "name", "description", "duration"],
    },
  },
  negate_effects: {
    name: "negate_effects",
    description: "Negate the effects of the card with an explanation.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Description of why the card's effect failed.",
        },
      },
      required: ["description"],
    },
  },
};

export default functionSchemas;