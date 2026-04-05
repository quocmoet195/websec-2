const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const BASE_URL = "https://ssau.ru/rasp";

async function fetchHtml(url) {
  const response = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
  return response.data;
}

app.get("/api/groups", async (req, res) => {
  try {
    const groups = [
      { id: "1213641978", name: "6413-100503D" },
      { id: "1282690279", name: "6412-100503D" },
      { id: "1282690301", name: "6411-100503D" }
    ];

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Не удалось получить список групп." });
  }
});


app.get("/api/current-week", (req, res) => {
  const currentWeek = 29;
  res.json({ week: currentWeek });
});


app.get("/api/schedule/group/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    const week = Number(req.query.week) || 29;
    const selectedWeekday = Number(req.query.selectedWeekday) || 1;

    const targetUrl =
      `${BASE_URL}?groupId=${groupId}&selectedWeek=${week}&selectedWeekday=${selectedWeekday}`;

    console.log("Fetching:", targetUrl);

    const html = await fetchHtml(targetUrl);

    fs.writeFileSync(path.join(__dirname, `week-${week}.html`), html, "utf8");

    const parsed = parseScheduleHtml(html, week, groupId);

    res.json(parsed);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Невозможно получить расписание группы." });
  }
});




app.get("/api/debug/structure/:groupId", async (req, res) => {
  try {
    const { groupId } = req.params;
    const week = Number(req.query.week) || 29;
    const selectedWeekday = Number(req.query.selectedWeekday) || 1;

    const targetUrl =
      `${BASE_URL}?groupId=${groupId}&selectedWeek=${week}&selectedWeekday=${selectedWeekday}`;

    const html = await fetchHtml(targetUrl);
    const $ = cheerio.load(html);

    const root = $(".schedule, .schedule_items, .card-default.timetable-card, .container.timetable").first();

    if (!root.length) {
      return res.json({ error: "Календарный блок не найден" });
    }

    const children = [];
    root.children().each((i, el) => {
      children.push({
        index: i,
        tag: el.tagName,
        class: $(el).attr("class") || "",
        id: $(el).attr("id") || "",
        text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 500)
      });
    });

    res.json({
      rootTag: root.get(0).tagName,
      rootClass: root.attr("class") || "",
      childCount: children.length,
      children
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "debug failed" });
  }
});


function parseScheduleHtml(html, week, groupId) {
  const $ = cheerio.load(html);

  const groupName =
    $("h1").first().text().replace("Расписание,", "").trim() ||
    `group-${groupId}`;

  const dayNames = [
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"
  ];

  const days = dayNames.map(day => ({
    day,
    date: "",
    lessons: []
  }));

  const scheduleRoot = $(".schedule").first();
  const scheduleItems = scheduleRoot.find(".schedule__items").first();

  if (!scheduleItems.length) {
    console.log("Không tìm thấy .schedule__items");
    return {
      mode: "group",
      groupId,
      groupName,
      week: Number(week),
      days
    };
  }

  const headers = scheduleItems.children(".schedule__item.schedule__head");

  headers.each((index, el) => {
    if (index === 0) return;

    const weekday = $(el).find(".schedule__head-weekday").text().trim();
    const date = $(el).find(".schedule__head-date").text().trim();

    if (days[index - 1]) {
      days[index - 1].day = capitalize(weekday);
      days[index - 1].date = date;
    }
  });

  const children = scheduleItems.children().toArray();

  let i = 7;

  while (i < children.length) {
    const $timeBlock = $(children[i]);

    if (!$timeBlock.hasClass("schedule__time")) {
      i++;
      continue;
    }

    const timeParts = $timeBlock.find(".schedule__time-item").map((_, el) => {
      return $(el).clone().children().remove().end().text().trim();
    }).get();

    let time = "";
    if (timeParts.length >= 2) {
      time = `${timeParts[0]}-${timeParts[1]}`;
    }

    for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
      const cellEl = children[i + 1 + dayIndex];
      if (!cellEl) continue;

      const $cell = $(cellEl);

      const lessonBlocks = $cell.find(".schedule__lesson").toArray();

      lessonBlocks.forEach(lessonEl => {
        const $lesson = $(lessonEl);

        const typeRu = $lesson.find(".schedule__lesson-type-chip").text().trim();
        const title = $lesson.find(".schedule__discipline").text().trim();
        const room = $lesson.find(".schedule__place").text().trim();

        let teacher = $lesson.find(".schedule__teacher").text().replace(/\s+/g, " ").trim();

        const typeMap = {
          "Лекция": "lecture",
          "Практика": "practice",
          "Лабораторная": "lab",
          "Экзамен": "exam",
          "Зачёт": "test",
          "Консультация": "consult",
          "Другое": "other"
        };

        const type = typeMap[typeRu] || "other";

        if (title || teacher || room) {
          days[dayIndex].lessons.push({
            time,
            title,
            teacher,
            room,
            type
          });
        }
      });
    }

    i += 7;
  }

  return {
    mode: "group",
    groupId,
    groupName,
    week: Number(week),
    days
  };
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}



app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});