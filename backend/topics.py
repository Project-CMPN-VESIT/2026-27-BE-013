TOPICS = {
    "artificial intelligence": {
        "label": "Artificial Intelligence",
        "description": "From academic research to ChatGPT disruption to existential regulation debates",
        "category": "Technology",
        "color": "#378ADD",
        "india_balanced": False,
        "search_query": "artificial intelligence OR machine learning OR ChatGPT OR deep learning",
    },
    "climate change": {
        "label": "Climate Change",
        "description": "From scientific warnings to youth movements to fossil fuel phase-out debates",
        "category": "Environment",
        "color": "#1D9E75",
        "india_balanced": False,
        "search_query": "climate change OR global warming OR carbon emissions OR COP",
    },
    "cryptocurrency": {
        "label": "Cryptocurrency",
        "description": "From speculative boom to institutional adoption to FTX collapse",
        "category": "Finance",
        "color": "#EF9F27",
        "india_balanced": False,
        "search_query": "cryptocurrency OR bitcoin OR blockchain OR crypto OR ethereum",
    },
    "india politics": {
        "label": "India Politics",
        "description": "BJP consolidation, CAA protests, COVID mismanagement to 2024 elections",
        "category": "India",
        "color": "#FF6B35",
        "india_balanced": True,
        "search_query": "India politics OR BJP OR Congress OR Modi OR Indian elections",
    },
    "india nationalism": {
        "label": "India Nationalism",
        "description": "From Hindu nationalist mobilisation to Hindutva governance to Ram Mandir",
        "category": "India",
        "color": "#D4537E",
        "india_balanced": True,
        "search_query": "Hindu nationalism OR Hindutva OR RSS OR CAA India OR cow vigilante",
    },
    "india economy": {
        "label": "India Economy",
        "description": "From fastest growing economy to demonetisation shock to UPI revolution",
        "category": "India",
        "color": "#1D9E75",
        "india_balanced": True,
        "search_query": "India economy OR GDP India OR demonetisation OR GST India OR UPI payments",
    },
    "covid-19": {
        "label": "COVID-19",
        "description": "From Wuhan outbreak to global pandemic to vaccines to endemic transition",
        "category": "Global",
        "color": "#7F77DD",
        "india_balanced": False,
        "search_query": "COVID-19 OR coronavirus OR pandemic OR lockdown OR vaccine",
    },
    "ukraine war": {
        "label": "Ukraine War",
        "description": "From Russian invasion to Western sanctions to protracted conflict",
        "category": "Global",
        "color": "#534AB7",
        "india_balanced": False,
        "search_query": "Ukraine war OR Russia Ukraine OR Zelensky OR NATO Ukraine OR Kyiv",
    },
    "us elections": {
        "label": "US Elections",
        "description": "From Trump 2016 shock to Biden 2020 to MAGA resurgence in 2024",
        "category": "Global",
        "color": "#993556",
        "india_balanced": False,
        "search_query": "US election OR American election OR Trump OR Biden OR Democrat Republican president",
    },
    "gaza palestine": {
        "label": "Gaza Palestine",
        "description": "From decade of blockade to October 7 attack to full scale war",
        "category": "Global",
        "color": "#3C3489",
        "india_balanced": False,
        "search_query": "Gaza OR Palestine OR Hamas OR Israel Gaza OR West Bank ceasefire",
    },
    "social media": {
        "label": "Social Media",
        "description": "From platform growth to misinformation crisis to regulation debates",
        "category": "Technology",
        "color": "#0F6E56",
        "india_balanced": False,
        "search_query": "social media OR Facebook OR Twitter OR Instagram OR TikTok misinformation",
    },
    "india pakistan": {
        "label": "India Pakistan",
        "description": "From surgical strikes to Pulwama to Article 370 to frozen relations",
        "category": "India",
        "color": "#854F0B",
        "india_balanced": True,
        "search_query": "India Pakistan OR Kashmir conflict OR LOC OR surgical strikes OR Pulwama",
    },
    "global inflation": {
        "label": "Global Inflation",
        "description": "From post-pandemic supply shocks to energy crisis to central bank rate wars",
        "category": "Finance",
        "color": "#993C1D",
        "india_balanced": False,
        "search_query": "inflation OR interest rates OR Federal Reserve OR cost of living OR recession",
    },
    "farmers protest india": {
        "label": "Farmers Protest India",
        "description": "From farm laws passage to year-long protest to repeal and 2024 revival",
        "category": "India",
        "color": "#3B6D11",
        "india_balanced": True,
        "search_query": "farmers protest India OR farm laws India OR MSP India OR kisan andolan",
    },
    "bollywood": {
        "label": "Bollywood",
        "description": "From box office dominance to nepotism debate to OTT disruption",
        "category": "India",
        "color": "#D85A30",
        "india_balanced": True,
        "search_query": "Bollywood OR Hindi cinema OR Bollywood film OR nepotism Bollywood OR OTT India",
    },
    "indian cricket": {
        "label": "Indian Cricket",
        "description": "From IPL dominance to World Cup victory to BCCI power in global cricket",
        "category": "India",
        "color": "#185FA5",
        "india_balanced": False,
        "search_query": "Indian cricket OR BCCI OR IPL OR Virat Kohli OR Rohit Sharma OR Team India",
    },
    "china taiwan": {
        "label": "China Taiwan",
        "description": "From cross-strait tensions to military drills to semiconductor war",
        "category": "Global",
        "color": "#A32D2D",
        "india_balanced": False,
        "search_query": "China Taiwan OR Taiwan strait OR PLA Taiwan OR Taiwan independence OR TSMC",
    },
    "mental health": {
        "label": "Mental Health",
        "description": "From stigma and silence to pandemic crisis to mainstream awareness",
        "category": "Global",
        "color": "#534AB7",
        "india_balanced": False,
        "search_query": "mental health OR depression OR anxiety OR therapy OR suicide prevention",
    },
    "electric vehicles": {
        "label": "Electric Vehicles",
        "description": "From Tesla disruption to EV race to charging infrastructure debates",
        "category": "Technology",
        "color": "#0F6E56",
        "india_balanced": False,
        "search_query": "electric vehicle OR EV OR Tesla OR EV battery OR charging infrastructure",
    },
    "uniform civil code": {
        "label": "Uniform Civil Code",
        "description": "From BJP manifesto promise to Uttarakhand implementation to national debate",
        "category": "India",
        "color": "#7F77DD",
        "india_balanced": True,
        "search_query": "Uniform Civil Code OR UCC India OR personal law India OR triple talaq",
    },
}

# Trusted sources — used to filter Google News results
GLOBAL_SOURCES = [
    "reuters.com", "apnews.com", "bbc.com",
    "theguardian.com", "aljazeera.com", "bloomberg.com",
]

INDIA_LEFT_SOURCES = [
    "thewire.in", "scroll.in", "ndtv.com", "theprint.in",
]

INDIA_CENTRE_SOURCES = [
    "thehindu.com", "indianexpress.com",
    "hindustantimes.com", "livemint.com",
]

INDIA_RIGHT_SOURCES = [
    "opindia.com", "firstpost.com",
    "republicworld.com", "swarajyamag.com",
]

INDIA_ALL_SOURCES = (
    INDIA_LEFT_SOURCES +
    INDIA_CENTRE_SOURCES +
    INDIA_RIGHT_SOURCES +
    GLOBAL_SOURCES
)

PRELOADED = list(TOPICS.keys())


def get_topic(topic_key: str) -> dict:
    key = topic_key.lower().strip()
    if key in TOPICS:
        return {**TOPICS[key], "key": key}
    return {
        "key":           key,
        "label":         topic_key.title(),
        "description":   f"Real-time narrative analysis for '{topic_key}'",
        "category":      "Custom",
        "color":         "#378ADD",
        "india_balanced": False,
        "search_query":  topic_key,
    }