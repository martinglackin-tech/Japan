// Phrasebook content. Loaded by the app (index.html) and by tools/generate-audio.mjs,
// so keep it free of DOM access.
(function () {
    const categories = {
        greetings: { name: "Greetings & Polite Essentials", short: "Greetings", icon: "🎌", jp: "挨拶と基本表現" },
        coeliac: { name: "Coeliac & Gluten-Free", short: "Coeliac & GF", icon: "🌾", jp: "セリアック・グルテンフリー" },
        dining: { name: "Drinking & Dining", short: "Dining & Drinks", icon: "🍱", jp: "飲食・レストラン" },
        about: { name: "About Us & Introductions", short: "About Us", icon: "👥", jp: "自己紹介と会話" },
        travel: { name: "Getting Around & Paying", short: "Travel & Pay", icon: "🚆", jp: "移動・お会計・便利表現" }
    };

    const categoryOrder = ["greetings", "coeliac", "dining", "about", "travel"];

    const phrases = [
        // Greetings & polite essentials
        { id: 1, category: "greetings", english: "Hello / Good day", romaji: "Konnichiwa", japanese: "こんにちは。" },
        { id: 2, category: "greetings", english: "Good morning", romaji: "Ohayō gozaimasu", japanese: "おはようございます。" },
        { id: 3, category: "greetings", english: "Good evening", romaji: "Konbanwa", japanese: "こんばんは。" },
        { id: 4, category: "greetings", english: "Thank you", romaji: "Arigatō gozaimasu", japanese: "ありがとうございます。" },
        { id: 5, category: "greetings", english: "Thank you very much (upon leaving)", romaji: "Arigatō gozaimashita", japanese: "ありがとうございました。" },
        { id: 6, category: "greetings", english: "Excuse me / Sorry", romaji: "Sumimasen", japanese: "すみません。" },
        { id: 7, category: "greetings", english: "Please", romaji: "Onegaishimasu", japanese: "お願いします。" },
        { id: 8, category: "greetings", english: "Yes", romaji: "Hai", japanese: "はい" },
        { id: 9, category: "greetings", english: "No", romaji: "Iie", japanese: "いいえ" },
        { id: 10, category: "greetings", english: "Don't worry, it's okay, I'm fine", romaji: "Daijōbu desu", japanese: "大丈夫です。" },

        // Coeliac & gluten-free
        { id: 1001, category: "coeliac", english: "I have a severe wheat and gluten allergy", romaji: "Komugi to guruten no arerugī ga arimasu", japanese: "小麦とグルテンのアレルギーがあります。" },
        { id: 1002, category: "coeliac", english: "I cannot eat wheat, barley, or rye", romaji: "Komugi, ōmugi, raimugi wa taberaremasen", japanese: "小麦、大麦、ライ麦は食べられません。" },
        { id: 1004, category: "coeliac", english: "Does this contain wheat or soy sauce?", romaji: "Kore ni komugi ya shōyu wa haitte imasu ka?", japanese: "これに小麦や醤油は入っていますか？" },
        { id: 1005, category: "coeliac", english: "Do you have soy sauce made without wheat?", romaji: "Komugi fushiyō no shōyu wa arimasu ka?", japanese: "小麦不使用の醤油はありますか？" },
        { id: 1006, category: "coeliac", english: "Please do not add any sauce or broth", romaji: "Tare ya dashi wa tsukenaide kudasai", japanese: "タレや出汁はつけないでください。" },
        { id: 1007, category: "coeliac", english: "Can you prepare it with just salt?", romaji: "Shio dake de chōri dekimasu ka?", japanese: "塩だけで調理できますか？" },

        // Drinking & dining
        { id: 28, category: "dining", english: "Table for two, please", romaji: "Futari desu", japanese: "二人です。" },
        { id: 29, category: "dining", english: "This one, please (pointing to menu)", romaji: "Kore o onegaishimasu", japanese: "これをお願いします。" },
        { id: 14, category: "dining", english: "Cheers! (for drinks)", romaji: "Kanpai!", japanese: "乾杯！" },
        { id: 16, category: "dining", english: "Please give me beer/water/tea", romaji: "Bīru / o-mizu / o-cha kudasai", japanese: "ビール／お水／お茶 ください。" },
        { id: 13, category: "dining", english: "Let's eat! / Bon appétit", romaji: "Itadakimasu", japanese: "いただきます！" },
        { id: 27, category: "dining", english: "It is delicious!", romaji: "Oishī desu", japanese: "美味しいです！" },
        { id: 17, category: "dining", english: "Can I get the bill, please? (Tip: cross index fingers into an 'X')", romaji: "Okaikei onegaishimasu", japanese: "お会計お願いします。" },
        { id: 15, category: "dining", english: "Thank you for the meal (after eating)", romaji: "Gochisōsama deshita", japanese: "ごちそうさまでした。" },
        { id: 30, category: "dining", english: "We'll be back!", romaji: "Mata kimasu!", japanese: "また来ます！" },

        // About us & introductions
        { id: 18, category: "about", english: "My name is Josey", romaji: "Watashi no namae wa Jōzī desu", japanese: "私の名前はジョーズィーです。" },
        { id: 19, category: "about", english: "My name is Frankie", romaji: "Watashi no namae wa Furankī desu", japanese: "私の名前はフランキーです。" },
        { id: 20, category: "about", english: "I am from the UK", romaji: "Watashi wa Igirisu kara kimashita", japanese: "私はイギリスから来ました。" },
        { id: 21, category: "about", english: "Do you understand English?", romaji: "Eigo wakarimasu ka?", japanese: "英語分かりますか？" },
        { id: 22, category: "about", english: "I don't understand Japanese", romaji: "Nihongo wakarimasen", japanese: "日本語分かりません。" },
        { id: 23, category: "about", english: "Cool, pretty, cute", romaji: "Kakkoī, kirei, kawaī", japanese: "かっこいい、きれい、かわいい。" },

        // Getting around & paying
        { id: 24, category: "travel", english: "Where is the toilet?", romaji: "Toire wa doko desu ka?", japanese: "トイレはどこですか？" },
        { id: 25, category: "travel", english: "Can I use card?", romaji: "Kādo wa tsukaemasu ka?", japanese: "カードは使えますか？" },
        { id: 26, category: "travel", english: "Excuse me, where does this train depart from?", romaji: "Sumimasen, kono densha wa doko kara demasu ka?", japanese: "すみません、この電車はどこから出ますか？" }
    ];

    const words = [
        { id: 101, category: "greetings", english: "Hello", romaji: "Konnichiwa", japanese: "こんにちは" },
        { id: 102, category: "greetings", english: "Good morning", romaji: "Ohayō", japanese: "おはよう" },
        { id: 103, category: "greetings", english: "Good evening", romaji: "Konbanwa", japanese: "こんばんは" },
        { id: 104, category: "greetings", english: "Thank you", romaji: "Arigatō", japanese: "ありがとう" },
        { id: 127, category: "greetings", english: "Please", romaji: "Onegaishimasu", japanese: "お願いします" },
        { id: 105, category: "greetings", english: "Yes", romaji: "Hai", japanese: "はい" },
        { id: 106, category: "greetings", english: "No", romaji: "Iie", japanese: "いいえ" },
        { id: 107, category: "greetings", english: "Okay / Fine (polite)", romaji: "Daijōbu desu", japanese: "大丈夫です" },
        { id: 108, category: "greetings", english: "Excuse me", romaji: "Sumimasen", japanese: "すみません" },
        { id: 112, category: "dining", english: "Beer", romaji: "Bīru", japanese: "ビール" },
        { id: 113, category: "dining", english: "Water", romaji: "O-mizu", japanese: "お水" },
        { id: 114, category: "dining", english: "Tea", romaji: "Ocha", japanese: "お茶" },
        { id: 115, category: "dining", english: "Please give me", romaji: "Kudasai", japanese: "ください" },
        { id: 116, category: "dining", english: "Bill", romaji: "Okaikei", japanese: "お会計" },
        { id: 117, category: "dining", english: "Cheers!", romaji: "Kanpai!", japanese: "乾杯！" },
        { id: 118, category: "dining", english: "Bon appétit", romaji: "Itadakimasu", japanese: "いただきます" },
        { id: 126, category: "dining", english: "Delicious", romaji: "Oishī", japanese: "おいしい" },
        { id: 128, category: "dining", english: "Two people", romaji: "Futari", japanese: "二人" },
        { id: 129, category: "dining", english: "This one", romaji: "Kore", japanese: "これ" },
        { id: 119, category: "about", english: "English", romaji: "Eigo", japanese: "英語" },
        { id: 120, category: "about", english: "Japanese", romaji: "Nihongo", japanese: "日本語" },
        { id: 121, category: "about", english: "UK / Britain", romaji: "Igirisu", japanese: "イギリス" },
        { id: 122, category: "travel", english: "Toilet", romaji: "Toire", japanese: "トイレ" },
        { id: 123, category: "travel", english: "Where", romaji: "Doko", japanese: "どこ" },
        { id: 124, category: "travel", english: "Train", romaji: "Densha", japanese: "電車" },
        { id: 125, category: "travel", english: "Card", romaji: "Kādo", japanese: "カード" }
    ];

    // Plain text for reading the chef card aloud. Scraping the card's innerText
    // would also read the <rt> furigana, so each grain word was spoken twice.
    const CHEF_CARD_SPEECH = "重要。セリアック病、重度の小麦・グルテンアレルギーがあります。小麦、大麦、ライ麦を一切摂取できません。普通の醤油、たれ、つゆ、麦味噌、だしの素も摂取できません。揚げ油、茹で汁、調理器具の共用も避けてください。小麦を含まない料理、または塩のみ、素焼きで提供できるものはありますか？";

    // Normalises text before it is spoken. Recordings in audio/index.json are keyed by
    // this output, so the generator and the app must share it.
    function toSpeechText(text) {
        // Keep ？ and ！ so voices use question / exclamation intonation.
        return text
            .replace(/[\/\／]/g, '、')
            .replace(/[\(\)（）【】「」]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Every distinct piece of text the app can speak.
    function allSpeechTexts() {
        const texts = [...phrases, ...words].map(item => item.japanese);
        texts.push(CHEF_CARD_SPEECH);
        return [...new Set(texts.map(toSpeechText))];
    }

    globalThis.PHRASEBOOK = { categories, categoryOrder, phrases, words, CHEF_CARD_SPEECH, toSpeechText, allSpeechTexts };
})();
