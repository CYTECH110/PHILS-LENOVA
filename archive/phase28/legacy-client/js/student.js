(function () {
  const api = window.LearnovaApi && window.LearnovaApi.apiRequest;
  if (!api) {
    console.error('LearnovaApi is not loaded');
    return;
  }

  const ready = window.LearnovaApi.requireRole('STUDENT');

  const logoutBtn = document.querySelector('#logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      if (window.LearnovaApi && window.LearnovaApi.signOut) {
        window.LearnovaApi.signOut();
      }
    });
  }

  const quizzesContainer = document.querySelector('#quizzes');
  const historyContainer = document.querySelector('#history');

  async function loadDashboard() {
    try {
      const [quizzesRes, historyRes] = await Promise.all([
        api('/student/quizzes'),
        api('/student/history')
      ]);

      if (quizzesContainer) {
        const list = quizzesRes && quizzesRes.quizzes ? quizzesRes.quizzes : [];
        if (!list.length) {
          quizzesContainer.innerHTML = '<p>No quizzes are available.</p>';
        } else {
          quizzesContainer.innerHTML = list
            .map(function (quiz) {
              const title = quiz.title || 'Quiz';
              const course = quiz.course_name || '';
              const minutes = quiz.duration_minutes || '';
              const id = quiz.id;
              return (
                '<article class="panel">' +
                '<h3>' + title + '</h3>' +
                '<p>' + course + (minutes ? ' · ' + minutes + ' minutes' : '') + '</p>' +
                '<a class="role-links" href="/pages/student/quiz.html?id=' + id + '">Start quiz</a>' +
                '</article>'
              );
            })
            .join('');
        }
      }

      if (historyContainer) {
        const history = historyRes && historyRes.history ? historyRes.history : [];
        if (!history.length) {
          historyContainer.innerHTML = '<p>No completed quizzes yet.</p>';
        } else {
          historyContainer.innerHTML = history
            .map(function (item) {
              const title = item.title || 'Quiz';
              const score = item.score === null || item.score === undefined ? 'pending' : item.score;
              const status = item.status || '';
              return '<p>' + title + ': ' + score + ' (' + status + ')</p>';
            })
            .join('');
        }
      }
    } catch (error) {
      if (quizzesContainer) {
        quizzesContainer.textContent = error.message || 'Failed to load quizzes';
      }
    }
  }

  if (quizzesContainer || historyContainer) {
    ready.then(function (allowed) {
      if (allowed) loadDashboard();
    });
  }

  const quizForm = document.querySelector('#quiz-form');
  const quizTitle = document.querySelector('#title');
  const messageEl = document.querySelector('#message');

  if (quizForm && quizTitle) {
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get('id');

    function renderQuiz(data) {
      const q = data && data.quiz ? data.quiz : {};
      quizTitle.textContent = q.title || 'Quiz';
      const questions = (data && data.questions) || [];
      quizForm.innerHTML = questions
        .map(function (question, index) {
          const qid = question.id;
          const text = question.question_text || '';
          const opts = Array.isArray(question.options) && question.options.length
            ? question.options
                .map(function (option) {
                  return '<label><input type="radio" name="question-' + qid + '" value="' + option + '" required>' + option + '</label>';
                })
                .join('')
            : '<input name="question-' + qid + '" required>';
          return (
            '<section class="panel"><h2>' + (index + 1) + '. ' + text + '</h2>' + opts + '</section>'
          );
        })
        .join('') + '<button type="submit">Submit quiz</button>';

      quizForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const formData = new FormData(quizForm);
        const answers = questions.map(function (question) {
          const val = formData.get('question-' + question.id);
          return { question_id: question.id, answer: val || '' };
        });
        try {
          const result = await api('/student/attempts/' + (data.attempt && data.attempt.id) + '/submit', {
            method: 'POST',
            body: JSON.stringify({ answers: answers })
          });
          if (messageEl) {
            messageEl.textContent = 'Submitted: ' + (result.score || 0) + ' / ' + (result.total || questions.length);
          }
          quizForm.innerHTML = '';
        } catch (error) {
          if (messageEl) {
            messageEl.textContent = error.message || 'Submission failed';
          }
        }
      });
    }

    function getLocation() {
      return new Promise(function (resolve) {
        if (!navigator.geolocation) {
          return resolve(null);
        }
        navigator.geolocation.getCurrentPosition(
          function (position) {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy_meters: position.coords.accuracy
            });
          },
          function () {
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    async function startQuiz() {
      try {
        const location = await getLocation();
        const accessCode = window.prompt('Access code, if required:') || '';
        const payload = { access_code: accessCode };
        if (location) {
          payload.latitude = location.latitude;
          payload.longitude = location.longitude;
          payload.accuracy_meters = location.accuracy_meters;
        }
        const data = await api('/student/quizzes/' + quizId + '/start', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        renderQuiz(data);
      } catch (error) {
        if (messageEl) {
          messageEl.textContent = error.message || 'Failed to start quiz';
        }
      }
    }

    if (quizId) {
      ready.then(function (allowed) {
        if (allowed) startQuiz();
      });
    }
  }
})();
