require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const TMDB_BASE = "https://api.themoviedb.org/3";

const MOVIE_ROWS = [
  {
    id: "now-playing",
    title: "현재 상영 중",
    path: "/movie/now_playing",
    params: { region: "KR" },
  },
  {
    id: "popular",
    title: "인기 영화",
    path: "/movie/popular",
  },
  {
    id: "action",
    title: "액션",
    path: "/discover/movie",
    params: { with_genres: "28", sort_by: "popularity.desc" },
  },
  {
    id: "comedy",
    title: "코미디",
    path: "/discover/movie",
    params: { with_genres: "35", sort_by: "popularity.desc" },
  },
  {
    id: "horror",
    title: "공포",
    path: "/discover/movie",
    params: { with_genres: "27", sort_by: "popularity.desc" },
  },
  {
    id: "romance",
    title: "로맨스",
    path: "/discover/movie",
    params: { with_genres: "10749", sort_by: "popularity.desc" },
  },
  {
    id: "scifi",
    title: "SF",
    path: "/discover/movie",
    params: { with_genres: "878", sort_by: "popularity.desc" },
  },
];

const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

function getApiKey() {
  return process.env.TMDB_API_KEY;
}

function hasHangul(text) {
  return /[\uAC00-\uD7A3]/.test(text);
}

function localizeTitle(koMovie, englishTitle) {
  if (hasHangul(koMovie.title)) {
    return koMovie.title;
  }

  if (englishTitle) {
    return englishTitle;
  }

  return koMovie.title;
}

async function fetchTmdb(pathname, apiKey, params = {}) {
  const query = new URLSearchParams({
    api_key: apiKey,
    language: "ko-KR",
    region: "KR",
    ...params,
  });

  const response = await fetch(`${TMDB_BASE}${pathname}?${query}`);

  if (!response.ok) {
    throw new Error(`TMDB API 요청 실패 (${response.status})`);
  }

  return response.json();
}

async function fetchLocalizedMovies(apiKey, row) {
  const [koData, enData] = await Promise.all([
    fetchTmdb(row.path, apiKey, row.params),
    fetchTmdb(row.path, apiKey, { ...row.params, language: "en-US" }),
  ]);

  const englishTitles = new Map(
    enData.results.map((movie) => [movie.id, movie.title])
  );

  return koData.results.map((movie) => ({
    ...movie,
    title: localizeTitle(movie, englishTitles.get(movie.id)),
  }));
}

function cleanReviewContent(content) {
  return content.replace(/\s+/g, " ").trim();
}

async function fetchMovieReviews(apiKey, movieId) {
  try {
    const query = new URLSearchParams({
      api_key: apiKey,
      page: "1",
    });
    const response = await fetch(
      `${TMDB_BASE}/movie/${movieId}/reviews?${query}`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    return (data.results || [])
      .map((review) => ({
        author: review.author,
        content: cleanReviewContent(review.content),
      }))
      .filter((review) => review.content.length > 15)
      .slice(0, 4);
  } catch {
    return [];
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );

  await Promise.all(workers);
  return results;
}

async function attachReviewsToMovies(apiKey, movies) {
  return mapWithConcurrency(movies, 6, async (movie) => ({
    ...movie,
    reviews: await fetchMovieReviews(apiKey, movie.id),
  }));
}

app.get("/api/movies/rows", async (req, res) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return res.status(500).json({ error: "TMDB_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const rows = await Promise.all(
      MOVIE_ROWS.map(async (row) => {
        const movies = await fetchLocalizedMovies(apiKey, row);
        const moviesWithReviews = await attachReviewsToMovies(apiKey, movies);

        return {
          id: row.id,
          title: row.title,
          movies: moviesWithReviews,
        };
      })
    );

    res.json({ rows });
  } catch (error) {
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

app.get("/api/movies/now-playing", async (req, res) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    return res.status(500).json({ error: "TMDB_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const movies = await fetchLocalizedMovies(apiKey, MOVIE_ROWS[0]);
    const moviesWithReviews = await attachReviewsToMovies(apiKey, movies);
    res.json({ results: moviesWithReviews });
  } catch (error) {
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

module.exports = app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT} 에서 실행 중`);
  });
}
