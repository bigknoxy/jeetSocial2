const ADJECTIVES = [
    'Silly', 'Dizzy', 'Wobbly', 'Goofy', 'Fluffy', 'Happy', 'Zip', 'Chunky',
    'Shiny', 'Breezy', 'Sparkly', 'Cheerful', 'Kind', 'Radiant', 'Zesty',
    'Mellow', 'Bouncy', 'Glowing', 'Peppy', 'Sunny', 'Whimsical', 'Funky'
];

const CREATURES = [
    'Godzilla', 'Pixie', 'Gremlin', 'Yeti', 'Panda', 'Unicorn', 'Dragon',
    'Phoenix', 'Griffin', 'Robot', 'Alien', 'Ghost', 'Kitten', 'Puppy',
    'Otter', 'Sloth', 'Hamster', 'Axolotl', 'Capybara', 'Narwhal'
];

export function generateUsername(): string {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const creature = CREATURES[Math.floor(Math.random() * CREATURES.length)];
    const num = Math.floor(Math.random() * 99) + 1;
    return `${adj}${creature}${num}`;
}
