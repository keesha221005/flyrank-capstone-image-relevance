// test/fixtures/evalPosts.js
// Eval set: one post per category with a known-correct expected_subject.
// Precision = (posts where top accepted candidate has the correct subject) / (total posts)

const EVAL_POSTS = [
  {
    title: 'Understanding deer behavior in forests',
    body: 'Deer are graceful herbivores commonly found grazing at forest edges. They are known for their keen senses and tendency to travel in small herds.',
    expected_subject: 'deer',
  },
  {
    title: 'Brown bear habitats and diet',
    body: 'Brown bears are powerful omnivores found across forests and mountains. They forage widely and are known for their strength and adaptability.',
    expected_subject: 'bear',
  },
  {
    title: 'The loyal companionship of dogs',
    body: 'Dogs have been human companions for thousands of years, valued for their loyalty, trainability, and range of breeds suited to different roles.',
    expected_subject: 'dog',
  },
  {
    title: 'The behavior of red foxes',
    body: 'Red foxes are highly adaptable animals known for their cunning hunting strategies and distinctive orange coats. Vulpes vulpes thrives in forests, grasslands, and even urban areas.',
    expected_subject: 'fox',
  },
  // PENDING — requires wolf images tagged (0/10 as of today).
  // This is the brief's signature adversarial case: does a wolf ever get
  // wrongly accepted for a fox post? Add once wolf data exists.
  // {
  //   title: 'The behavior of red foxes',
  //   body: '...',
  //   expected_subject: 'fox',
  //   note: 'adversarial — checks wolf is never accepted here',
  // },
];

module.exports = { EVAL_POSTS };