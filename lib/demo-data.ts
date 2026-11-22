/**
 * Demo content: three FICTIONAL students (one per exam track: IELTS, UNT, NIS) with lessons and
 * original sample essays written for this demo. Names end in "(демо)" so they're never mistaken
 * for real students. Text varies by the tutor's UI language (kk / ru); essays are in English.
 */
import type { Exam, OutputLanguage } from "@/lib/constants";

export const DEMO_ESSAYS = {
  draft: {
    prompt:
      "Some people think that young people should be required to do unpaid community work in their free time. To what extent do you agree or disagree?",
    text: `Nowadays many people believe that teenagers must do unpaid work for their community, for example cleaning parks or helping old people. In my opinion, this idea has more advantages than disadvantages, but it should not be compulsory for everyone.

Firstly, community work teach young people responsibility. When a student helps in a hospital or a library, he understand that his actions have real results for other people. This experience can be more useful than many lessons at school. Also, it helps to build skills like teamwork and communication, which employers value very much.

On the other hand, students today already have a lot of pressure. They study for exams like UNT or IELTS, they attend extra courses and some of them have part-time jobs. If the government forces them to work without money, they will have less time for rest and for their studies, and this can make their results worse.

In conclusion, I believe community work is a valuable experience, but schools should encourage it and give rewards instead of making it obligatory.`,
  },
  reviewed: {
    prompt:
      "Many cities are banning cars from their centres. Do the advantages of this development outweigh the disadvantages?",
    text: `In recent years, a number of cities around the world have closed their central streets to private cars. While this policy creates some problems for drivers and businesses, I believe the benefits are clearly more significant.

The main advantage is cleaner air. Traffic is one of the biggest sources of pollution in cities like Almaty, where smog in winter is a serious problem. When cars are removed from the centre, people can breathe more easily and the number of health problems decrease. Furthermore, streets without cars are safer and more pleasant for walking, so families and tourists spend more time there.

However, there are some drawbacks. People who live outside the centre may find it difficult to reach their workplaces, especially if public transport is not developed enough. Shop owners also worry that fewer customers will visit them.

To sum up, although banning cars causes inconvenience for some groups, the improvement in air quality and safety makes it a positive development, provided that cities invest in good public transport.`,
  },
};

type DemoStudent = {
  key: "ielts" | "unt" | "nis";
  exam: Exam;
  full_name: string;
  grade_or_age: string;
  target_score: string;
  parent_name: string;
  parent_phone: string;
  parent_language: OutputLanguage;
  notes: string;
  /** Lesson topics, oldest first. */
  topics: string[];
  /** Note for yesterday's lesson. */
  note: string;
};

type DemoText = {
  students: DemoStudent[];
  review: {
    comments: string[];
    feedback: string;
    flags: string[];
  };
  pastFeedback: string;
};

const IELTS_TOPICS = [
  "Writing Task 2: structure",
  "Writing Task 2: thesis statements",
  "Coherence: linking words",
  "Lexical resource: environment vocabulary",
  "Mock Writing Task 2",
];

export const DEMO_TEXT: Record<OutputLanguage, DemoText> = {
  kk: {
    students: [
      {
        key: "ielts", exam: "IELTS", full_name: "Әлия Сапарова (демо)", grade_or_age: "11-сынып", target_score: "7.0",
        parent_name: "Гүлнар Сапарова", parent_phone: "+7 701 000 00 01", parent_language: "kk",
        notes: "Демо оқушы. Writing бөлімінде дәлелдері жақсы, бірақ грамматикада қателер бар.",
        topics: IELTS_TOPICS, note: "Тезисті нақты жаза бастады. Келесі сабақта артикльдерді қайталау керек.",
      },
      {
        key: "unt", exam: "UNT", full_name: "Нұрсұлтан Ахметов (демо)", grade_or_age: "11-сынып", target_score: "120",
        parent_name: "Ерлан Ахметов", parent_phone: "+7 702 000 00 02", parent_language: "ru",
        notes: "Демо оқушы. ҰБТ: математика және физика.",
        topics: ["Функциялар және графиктер", "Квадрат теңдеулер", "Ықтималдық теориясы", "Физика: кинематика", "ҰБТ сынақ тесті"],
        note: "Сынақ тестінде 28/40. Ықтималдық тақырыбын қайталау керек.",
      },
      {
        key: "nis", exam: "NIS", full_name: "Дана Омарова (демо)", grade_or_age: "6-сынып", target_score: "НЗМ-ге түсу",
        parent_name: "Сәуле Омарова", parent_phone: "+7 705 000 00 03", parent_language: "kk",
        notes: "Демо оқушы. НЗМ түсу емтиханына дайындық: математика және логика.",
        topics: ["Логикалық есептер", "Бөлшектер", "Пайыздар", "Мәтінді есептер", "НЗМ сынақ тапсырмалары"],
        note: "Мәтінді есептерді жылдам шығарады, бірақ шартты мұқият оқу керек.",
      },
    ],
    review: {
      comments: [
        "Позиция анық, екі жағы да қарастырылған. Дегенмен дәлелдерді нақты мысалдармен тереңдету керек.",
        "Абзацтар логикалық реттелген, байланыстырғыш сөздер орынды. Кейбір ауысулар механикалық.",
        "Тақырыпқа сай лексика жеткілікті (pollution, drawbacks, inconvenience). Сөз тіркестерін әртараптандыру керек.",
        "Күрделі сөйлемдер бар, бірақ бастауыш пен баяндауыштың қиысуында қате бар.",
      ],
      feedback:
        "Жақсы жұмыс! Пікіріңіз анық және эссе құрылымы дұрыс. Келесі жолы әр дәлелге нақты мысал келтіріп, етістіктің жекеше/көпше түрін тексеріңіз (мысалы, \"the number ... decreases\").",
      flags: ["Демо бағалау: Aqylbek нәтижесінің үлгісі"],
    },
    pastFeedback: "Құрылым жақсарды. Грамматикаға көбірек көңіл бөліңіз.",
  },
  ru: {
    students: [
      {
        key: "ielts", exam: "IELTS", full_name: "Әлия Сапарова (демо)", grade_or_age: "11 класс", target_score: "7.0",
        parent_name: "Гульнар Сапарова", parent_phone: "+7 701 000 00 01", parent_language: "kk",
        notes: "Демо-ученица. В Writing хорошие аргументы, но есть грамматические ошибки.",
        topics: IELTS_TOPICS, note: "Начала чётко формулировать тезис. На следующем занятии повторить артикли.",
      },
      {
        key: "unt", exam: "UNT", full_name: "Нурсултан Ахметов (демо)", grade_or_age: "11 класс", target_score: "120",
        parent_name: "Ерлан Ахметов", parent_phone: "+7 702 000 00 02", parent_language: "ru",
        notes: "Демо-ученик. ЕНТ: математика и физика.",
        topics: ["Функции и графики", "Квадратные уравнения", "Теория вероятностей", "Физика: кинематика", "Пробный тест ЕНТ"],
        note: "Пробный тест: 28/40. Нужно повторить теорию вероятностей.",
      },
      {
        key: "nis", exam: "NIS", full_name: "Дана Омарова (демо)", grade_or_age: "6 класс", target_score: "Поступление в НИШ",
        parent_name: "Сауле Омарова", parent_phone: "+7 705 000 00 03", parent_language: "kk",
        notes: "Демо-ученица. Подготовка к вступительному экзамену НИШ: математика и логика.",
        topics: ["Логические задачи", "Дроби", "Проценты", "Текстовые задачи", "Пробные задания НИШ"],
        note: "Быстро решает текстовые задачи, но нужно внимательнее читать условие.",
      },
    ],
    review: {
      comments: [
        "Позиция ясна, рассмотрены обе стороны. Аргументы стоит подкрепить более конкретными примерами.",
        "Абзацы выстроены логично, связки уместны. Некоторые переходы звучат механически.",
        "Лексики по теме достаточно (pollution, drawbacks, inconvenience). Стоит разнообразить словосочетания.",
        "Есть сложные предложения, но встречаются ошибки согласования подлежащего и сказуемого.",
      ],
      feedback:
        "Хорошая работа! Позиция ясна, структура эссе правильная. В следующий раз подкрепляйте каждый аргумент конкретным примером и проверяйте согласование глагола (например, \"the number ... decreases\").",
      flags: ["Демо-оценка: пример результата Aqylbek"],
    },
    pastFeedback: "Структура стала лучше. Больше внимания грамматике.",
  },
};

/** Evidence quotes, taken word for word from the "reviewed" essay above. */
export const DEMO_EVIDENCE: string[][] = [
  ["While this policy creates some problems for drivers and businesses, I believe the benefits are clearly more significant."],
  ["The main advantage is cleaner air.", "However, there are some drawbacks."],
  ["the improvement in air quality and safety makes it a positive development"],
  ["the number of health problems decrease"],
];
