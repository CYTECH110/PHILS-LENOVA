function shuffle(items) {
  const values = [...items];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values;
}

function prepareQuestions(questions, settings) {
  const prepared = settings.randomize_questions ? shuffle(questions) : [...questions];
  return prepared.map((question) => ({
    ...question,
    options: settings.randomize_options && Array.isArray(question.options)
      ? shuffle(question.options)
      : question.options
  }));
}

module.exports = { shuffle, prepareQuestions };
