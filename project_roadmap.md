
# Project Roadmap: Ethereal Arena

## Milestone 1: Game Core Structure

### Task 1.1: Setup Next.js Project
- [x] 1.1.1: Initialize Next.js project
- [x] 1.1.2: Configure essential plugins and dependencies

### Task 1.2: Design and Implement Core Game State Structure
- [x] 1.2.1: Define health schema in game state
- [x] 1.2.2: Define energy schema in game state
- [x] 1.2.3: Define buffs schema in game state
- [x] 1.2.4: Define debuffs schema in game state
- [x] 1.2.5: Implement state management (React Context/Redux)
- [] 1.2.6: Implement shields

### Task 1.3: Create Basic UI Components
- [x] 1.3.1: Design HUD layout
- [x] 1.3.2: Create main HUD structure
    [x] Arena container
    [x] Combat log
    [x] Opponent area
        [x] hand
        [x] status
            [x] debuffs
            [x] HP/Energy
            [x] buffs
            [] shields
    [x] Card drop area
    [x] Player area
    [x] hand
        [x] status
            [x] debuffs
            [x] HP/Energy
            [x] buffs
- [x] 1.3.3: Create player health & energy display component
- [x] 1.3.4: Create card component
- [x] 1.3.5: Create hand display component
- [x] 1.3.6: Create combat log component
- [x] 1.3.7: Create card drop area component
- [] 1.3.8: Create components for buffs, debuffs
    [] Display icons on HUD
    [] Display description, duration on mouseover

## Milestone 2: AI Integration and Card Generation

### Task 2.1: Game Logic
- [x] 2.2.1: Create game context provider
    [x] Functions for updating game state
        [x] Player turn
        [x] Player hand
        [x] Health, energy, buffs, debuffs
        [] Shields
- [x] 2.2.2: Implement turn logic
    [x] Implement turn cycle
    [x] Call card generation
        [x] on turn end
        [x] on game start
        [x] change generation for turn 2 - either generate cards only for the first player for turn 1, or block regeneration of the second player's hand when the first turn ends
    [x] End turn button
- [x] 2.2.3: Implement Combat Log update
    [x] Define combat log entry schema
    [x] Combat log state variable
    [x] Function to add log entry
    [x] Call function inside existing event logic
        [x] When deciding who goes first
        [x] When generating cards
        [x] When player ends their turn
- [x] 2.2.4: Implement card playing logic
    [x] Zoom on mouseover
    [x] Click & drag cards
    [x] Release to drop
    [x] Game logic interpreter placeholder call
- [] 2.2.5: Implement Game Over logic
    [] Define win/lose conditions
    [] Create game over screen / message
- [x] 2.2.6: Integrate with existing components

### Task 2.2: Card Generation
- [x] 2.2.1: Create card generation prompt
- [x] 2.2.2: Create function calling schema
- [x] 2.2.3: Create function for calling OpenAI endpoint, inserting prompt
- [] Add game context to prompt - attempt to get cards suitable for current player/opponent status

### Task 2.3: Develop Game Logic Interpreter
- [x] Function for constructing JSON schema of current game state
    [x] Player states
- [x] Prompt template for injecting card effect, game state, available state change functions
- [x] Experiment with prompt chaining vs single response
    [] GLI returns array of relevant functions including arguments
    [x] GLI returns ordered list of functions to call in sequence -> trigger prompt chain to ask for arguments to each
- [x] Function for calling state change functions according to GLI's output
- [] Specific Combat Logs in state change functions

### MISC
- [] Clear player hand and card drop area when turn ends
- [] Define order of operations for state update functions
- [] Implement logic controls
    [] Don't let a user play cards if its not their turn
    [] Don't let them play a card if they don't have enough energy
    [] Don't let current HP > maximum
- [] Link played cards in Combat Log mouseover
- [] Reset energy on turn end or start