const API_URL = "/api/movies/rows";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
const CARD_REVIEW_INTERVAL_MS = 4500;
const MAX_CARD_REVIEW_LENGTH = 48;

const heroEl = document.getElementById("hero");
const heroTitleEl = document.getElementById("hero-title");
const heroMetaEl = document.getElementById("hero-meta");
const heroOverviewEl = document.getElementById("hero-overview");
const movieRowsEl = document.getElementById("movie-rows");
const headerEl = document.querySelector(".header");

function formatReleaseDate(releaseDate) {
  if (!releaseDate) {
    return "개봉일 미정";
  }

  const [year, month, day] = releaseDate.split("-");
  return `${year}.${month}.${day}`;
}

function formatRating(voteAverage) {
  if (voteAverage == null || voteAverage === 0) {
    return "평점 없음";
  }

  return `★ ${voteAverage.toFixed(1)}`;
}

function getMovieMetaText(movie) {
  return `개봉 ${formatReleaseDate(movie.release_date)} · ${formatRating(movie.vote_average)}`;
}

function truncateReview(content, maxLength = MAX_CARD_REVIEW_LENGTH) {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength).trim()}...`;
}

function shuffleReviews(reviews) {
  const shuffled = [...reviews];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function setHero(movie) {
  if (!movie) return;

  heroTitleEl.textContent = movie.title;
  heroMetaEl.textContent = getMovieMetaText(movie);
  heroOverviewEl.textContent = movie.overview || "줄거리 정보가 없습니다.";

  if (movie.backdrop_path) {
    heroEl.style.backgroundImage = `url(${BACKDROP_BASE}${movie.backdrop_path})`;
  }
}

function startCardReviewSlider(textEl, reviews) {
  const pool = shuffleReviews(reviews);
  let currentIndex = -1;

  function showReview(review, animate) {
    const content = `"${truncateReview(review.content)}"`;

    if (!animate) {
      textEl.textContent = content;
      return;
    }

    textEl.classList.add("movie-card__review-text--exit");

    window.setTimeout(() => {
      textEl.textContent = content;
      textEl.classList.remove("movie-card__review-text--exit");
      textEl.classList.add("movie-card__review-text--enter");

      requestAnimationFrame(() => {
        textEl.classList.remove("movie-card__review-text--enter");
      });
    }, 400);
  }

  function getNextIndex() {
    if (pool.length === 1) {
      return 0;
    }

    let nextIndex = currentIndex;

    while (nextIndex === currentIndex) {
      nextIndex = Math.floor(Math.random() * pool.length);
    }

    return nextIndex;
  }

  function playNext(animate) {
    currentIndex = getNextIndex();
    showReview(pool[currentIndex], animate);
  }

  playNext(false);

  if (pool.length <= 1) {
    return;
  }

  const startDelay = Math.random() * 2500;

  window.setTimeout(() => {
    window.setInterval(() => playNext(true), CARD_REVIEW_INTERVAL_MS);
  }, startDelay);
}

function createMovieCard(movie) {
  const card = document.createElement("article");
  card.className = "movie-card";

  const posterSrc = movie.poster_path
    ? `${IMAGE_BASE}${movie.poster_path}`
    : "https://via.placeholder.com/300x450/2a2a2a/999?text=No+Image";

  const hasReviews = movie.reviews?.length > 0;

  card.innerHTML = `
    <img
      class="movie-card__poster"
      src="${posterSrc}"
      alt="${movie.title} 포스터"
      loading="lazy"
    />
    <p class="movie-card__title">${movie.title}</p>
    <div class="movie-card__meta">
      <span class="movie-card__date">${formatReleaseDate(movie.release_date)}</span>
      <span class="movie-card__rating">${formatRating(movie.vote_average)}</span>
    </div>
    <div class="movie-card__review${hasReviews ? "" : " movie-card__review--empty"}">
      <p class="movie-card__review-text">${hasReviews ? "" : "리뷰 없음"}</p>
    </div>
  `;

  if (hasReviews) {
    const reviewTextEl = card.querySelector(".movie-card__review-text");
    startCardReviewSlider(reviewTextEl, movie.reviews);
  }

  card.addEventListener("click", () => setHero(movie));

  return card;
}

function createMovieRow(row) {
  const section = document.createElement("section");
  section.className = "row";

  const title = document.createElement("h2");
  title.className = "row__title";
  title.textContent = row.title;

  const posters = document.createElement("div");
  posters.className = "row__posters";

  row.movies.forEach((movie) => {
    posters.appendChild(createMovieCard(movie));
  });

  section.appendChild(title);
  section.appendChild(posters);

  return section;
}

async function loadMovies() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`API 요청 실패 (${response.status})`);
    }

    const data = await response.json();
    const rows = data.rows;

    if (!rows || rows.length === 0) {
      movieRowsEl.innerHTML = '<p class="error">표시할 영화가 없습니다.</p>';
      return;
    }

    const firstMovie = rows[0]?.movies?.[0];
    if (firstMovie) {
      setHero(firstMovie);
    }

    movieRowsEl.innerHTML = "";
    rows.forEach((row) => {
      if (row.movies?.length) {
        movieRowsEl.appendChild(createMovieRow(row));
      }
    });
  } catch (error) {
    movieRowsEl.innerHTML = `<p class="error">영화를 불러오지 못했습니다: ${error.message}</p>`;
    heroTitleEl.textContent = "오류 발생";
    heroOverviewEl.textContent = "잠시 후 다시 시도해 주세요.";
  }
}

window.addEventListener("scroll", () => {
  headerEl.classList.toggle("header--scrolled", window.scrollY > 80);
});

loadMovies();
