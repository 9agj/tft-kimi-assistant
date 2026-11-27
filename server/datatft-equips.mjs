#!/usr/bin/env node
/**
 * datatft-equips.mjs — dataTFT 数字装备 id → 装备 apiName 静态对照表
 *
 * 背景
 *   dataTFT 的 /team/strategy 返回的 equips 是纯数字 id（如 "525"、"31008"、"32346"），
 *   而我们自己的 lookups.items[] 只有 apiName / name / icon，没有数字 id，无法直接渲染图标。
 *   本文件提供构建期固化的数字 id → apiName 对照，运行时零联网、零 IO。
 *
 * 数据来源（2026-11-27 抓取，dataTFT 静态数据版本 20261124T084131810Z-0a38c2c1-6147-4611-b05f-d5cc2cbcd576）
 *   1) 站点数据分块 https://www.datatft.com/assets/data-cn-sEaOQYar.js
 *      —— AES-128-ECB + PKCS7 加密，密钥取自 bootstrap-DS9VDUgV.js 里的 N.key（base64）
 *   2) 解密后 JSON 的 equips18 / equips19 数组，字段 equipId → key(apiName) / name(中文名) / type2
 *   3) 交叉验证：36 套 S18 真实阵容的装备槽 → apiName，与该英雄在 /data/unititems 的
 *      Top10 常用装备比对，命中 68.2%；把映射整体位移 1 位后只剩 30.6%，
 *      证明对齐关系真实且未错位。
 *   4) 结构自洽：547 套成品 3 件套里散件（type2=part）出现 0 次。
 *
 * 赛季语义（重要）
 *   dataTFT 的数字 id 是**按赛季重排**的，不是全局稳定 id：
 *     31008 → equips18/19 是 DA_VoidStaff，equips16/16.5 是 TFT_Item_StatikkShiv
 *     624   → equips18/19 是 DA_RedBuff，  equips16/16.5 是 TFT_Item_RapidFireCannon
 *   本表只登记 S18 / S19（两季共享的 120 个 id 完全一致，无冲突）。
 *   需要其它赛季时请重新抓取 + 解密 + 导出，不要把本表套到 S16 及更早的数据上。
 *
 * 用法
 *   import { mapEquipId, EQUIP_MAP, getEquipMeta } from "./datatft-equips.mjs"
 *   mapEquipId("525")            // "DA_SpearOfShojin"
 *   mapEquipId("525", "19")      // 指定赛季优先查该赛季表，未命中回落合并表
 *   mapEquipId("999999")         // null
 *   getEquipMeta("581")          // { apiName: "DA_GargoyleStoneplate", name: "石像鬼石板甲", type2: "common", seasons: ["18","19"] }
 *
 * 本文件为一次性生成产物（解密站点 data-cn 分块后导出），请勿手改；
 * 需要更新时按上面「数据来源」重新抓取 + 解密 + 导出即可，不要手工增删条目。
 */

/** dataTFT 静态数据版本（生成依据） */
export const DATATFT_DATA_VERSION = "20261124T084131810Z-0a38c2c1-6147-4611-b05f-d5cc2cbcd576"

/** 覆盖的赛季 */
export const EQUIP_SEASONS = ["18","19"]

/** 数字 id → 装备 apiName（S18 ∪ S19 合并表，两季共享 id 无冲突） */
export const EQUIP_MAP = {
  "501": "DA_Component_BFSword",
  "502": "DA_Component_RecurveBow",
  "503": "DA_Component_NeedlesslyLargeRod",
  "504": "DA_Component_TearOfTheGoddess",
  "505": "DA_Component_ChainVest",
  "506": "DA_Component_NegatronCloak",
  "507": "DA_Component_GiantsBelt",
  "508": "DA_Component_Spatula",
  "509": "DA_Component_SparringGloves",
  "519": "DA_Deathblade",
  "521": "DA_GiantSlayer",
  "525": "DA_SpearOfShojin",
  "529": "DA_Bloodthirster",
  "535": "DA_InfinityEdge",
  "539": "DA_GuinsoosRageblade",
  "551": "DA_LastWhisper",
  "553": "DA_RabadonsDeathcap",
  "555": "DA_ArchangelsStaff",
  "561": "DA_Morellonomicon",
  "565": "DA_JeweledGauntlet",
  "567": "DA_BlueBuff",
  "577": "DA_HandOfJustice",
  "579": "DA_BrambleVest",
  "581": "DA_GargoyleStoneplate",
  "583": "DA_SunfireCape",
  "595": "DA_Quicksilver",
  "597": "DA_WarmogsArmor",
  "607": "DA_ThiefsGloves",
  "608": "DA_TacticiansCrown",
  "609": "DA_DragonsClaw",
  "610": "DA_HextechGunblade",
  "611": "DA_IonicSpark",
  "613": "DA_TitansResolve",
  "615": "DA_EdgeOfNight",
  "616": "DA_ProtectorsVow",
  "617": "DA_StrikersFlail",
  "618": "DA_SteraksGage",
  "619": "DA_NashorsTooth",
  "620": "DA_Crownguard",
  "621": "DA_AdaptiveHelm",
  "623": "DA_Evenshroud",
  "624": "DA_RedBuff",
  "625": "DA_SteadfastHeart",
  "1519": "DA_DeathbladeRadiant",
  "1521": "DA_GiantSlayer_Radiant",
  "1523": "DA_HextechGunbladeRadiant",
  "1525": "DA_SpearOfShojinRadiant",
  "1527": "DA_EdgeOfNightRadiant",
  "1529": "DA_BloodthirsterRadiant",
  "1535": "DA_InfinityEdgeRadiant",
  "1539": "DA_GuinsoosRagebladeRadiant",
  "1543": "DA_TitansResolve_Radiant",
  "1551": "DA_LastWhisperRadiant",
  "1553": "DA_RabadonsDeathcap_Radiant",
  "1555": "DA_ArchangelsStaffRadiant",
  "1559": "DA_IonicSparkRadiant",
  "1561": "DA_MorellonomiconRadiant",
  "1565": "DA_JeweledGauntletRadiant",
  "1567": "DA_BlueBuffRadiant",
  "1577": "DA_HandOfJusticeRadiant",
  "1579": "DA_BrambleVestRadiant",
  "1581": "DA_GargoyleStoneplate_Radiant",
  "1583": "DA_SunfireCape_Radiant",
  "1595": "DA_QuicksilverRadiant",
  "1597": "DA_WarmogsArmorRadiant",
  "1607": "DA_ThiefsGlovesRadiant",
  "1616": "DA_ProtectorsVowRadiant",
  "1617": "DA_StrikersFlailRadiant",
  "1618": "DA_SteraksGageRadiant",
  "1619": "DA_NashorsToothRadiant",
  "1620": "DA_CrownguardRadiant",
  "1621": "DA_AdaptiveHelm_Radiant",
  "1623": "DA_EvenshroudRadiant",
  "1624": "DA_RedBuffRadiant",
  "1625": "DA_SteadfastHeartRadiant",
  "20002": "DA_Artifact_DeathsDefiance",
  "20003": "DA_Artifact_Manazane",
  "20004": "DA_Artifact_InfinityForce",
  "20009": "DA_Artifact_GoldCollector",
  "20010": "DA_Artifact_ZhonyasParadox",
  "20011": "DA_Artifact_Hullcrusher",
  "20017": "DA_Artifact_MogulsMail",
  "20044": "DA_Artifact_Dawncore",
  "20101": "DA_Artifact_GamblersBlade",
  "30002": "DA_Item_Artifact_TalismanOfAscension",
  "30004": "DA_Artifact_Fishbones",
  "30006": "DA_Artifact_HorizonFocus",
  "30007": "DA_Artifact_Mittens",
  "30009": "DA_Artifact_RapidFireCannon",
  "30011": "DA_Artifact_LudensTempest",
  "30012": "DA_Artifact_SilvermereDawn",
  "30013": "TFT_Item_Artifact_ProwlersClaw",
  "30016": "DA_Artifact_BlightingJewel",
  "30017": "DA_Artifact_WitsEnd",
  "30018": "DA_Artifact_ForbiddenIdol",
  "30019": "DA_Artifact_LichBane",
  "30020": "DA_Artifact_LightshieldCrest",
  "30021": "DA_Artifact_SeekersArmguard",
  "30044": "DA_DragonsClawRadiant",
  "31000": "DA_Component_FryingPan",
  "31002": "DA_TacticiansShield",
  "31003": "DA_TacticiansCape",
  "31004": "DA_Artifact_NavoriFlickerblade",
  "31005": "DA_Artifact_StatikkShiv",
  "31006": "DA_Artifact_TitanicHydra",
  "31007": "DA_Artifact_TheIndomitable",
  "31008": "DA_VoidStaff",
  "31009": "DA_VoidStaffRadiant",
  "31010": "DA_KrakensFury",
  "31011": "DA_KrakensFury_Radiant",
  "31012": "DA_SpiritVisage",
  "31013": "DA_SpiritVisage_Radiant",
  "32311": "DA_LuckyItemChest",
  "32312": "TFT_Consumable_RecommendedArmoryRadiant",
  "32314": "DA_SalvagerUpgrade18",
  "32345": "DA_Artifact_VoidGauntlet",
  "32346": "DA_Artifact_AegisOfDawn",
  "32347": "DA_Artifact_HellfireHatchet",
  "32349": "DA_Artifact_AegisOfDusk",
  "32350": "DA_Artifact_CappaJuice",
  "32351": "DA_Artifact_EternalPact",
  "32544": "DA_Riftbeast18_Selector",
  "32545": "DA_CUSTOM_1",
  "32546": "DA_CUSTOM_2",
  "33019": "DA_18_EmblemBlossom",
  "33020": "DA_18_EmblemLunar",
  "33021": "DA_18_EmblemSprykin",
  "33022": "DA_18_EmblemFae",
  "33023": "DA_18_EmblemInferno",
  "33024": "DA_18_EmblemElderwood",
  "33025": "DA_18_EmblemBlackthorn",
  "33026": "DA_18_EmblemPrimal",
  "33027": "DA_18_EmblemExecutioner",
  "33028": "DA_18_EmblemBrawler",
  "33029": "DA_18_EmblemInvoker",
  "33030": "DA_18_EmblemRapidfire",
  "33031": "DA_18_EmblemSpellweaver",
  "33032": "DA_18_EmblemVanguard",
  "33033": "DA_18_EmblemHunter",
  "33034": "DA_18_EmblemSlayer",
  "33035": "DA_18_EmblemCoven",
  "33036": "DA_18_EmblemFloraFatalis",
  "33037": "DA_PhantomEmblem18",
  "33038": "DA_18_EmblemDefender",
  "33039": "DA_18_EmblemJuggernaut",
  "33044": "DA_HealthPotion18",
  "33046": "DA_BlastPotion18_Radiant",
  "33047": "DA_18_EmblemFloraFatalisAugment",
  "33051": "DA_ManaPotion18_Radiant",
  "33053": "DA_BlastPotion18",
  "33054": "DA_HealthPotion18_Radiant",
  "33055": "DA_ManaPotion18",
  "33056": "DA_KDA19_Emblem",
  "33057": "DA_Heartsteel19_Emblem",
  "33058": "DA_Arcanist19_Emblem",
  "33059": "DA_Bodyguard19_Emblem",
  "33060": "DA_IllBeats19_Emblem",
  "33061": "DA_IonicSpark19_Emblem",
  "33062": "DA_DemonVision19_Emblem",
  "33063": "DA_Oceansong19_Emblem",
  "33064": "DA_Pentakill19_Emblem",
  "33065": "DA_Jazz19_Emblem",
  "33066": "DA_TrueDamage19_Emblem",
  "33067": "DA_Swiftstriker19_Emblem",
  "33068": "DA_Renegade19_Emblem",
  "33069": "DA_Virtuosos19_Emblem",
  "33070": "DA_Choreographer19_Emblem",
  "33071": "DA_Juggernaut19_Emblem",
  "33072": "DA_Manager19_Emblem",
  "33073": "DA_Mosher19_Emblem",
  "33074": "DA_Hitmaker19_Emblem",
  "33075": "DA_Frontman19_Emblem",
  "33076": "DA_GlitterBomb19_Emblem",
  "33077": "TFT_Emblem_CHANGEME",
  "33078": "DA_Bard19_UniqueItem",
  "33079": "DA_Heavenscale19_DangerousItem",
  "33080": "DA_RanduinsOmen",
  "33081": "DA_ZZRotPortal",
  "33082": "DA_ZekesHerald",
  "33083": "DA_ChaliceOfPower",
  "33084": "DA_Heavenscale19_HeavenlyPrayer"
}

/** 按赛季分表：{ "19": { id: apiName }, "18": { id: apiName } } */
export const EQUIP_MAP_BY_SEASON = {
  "18": {
    "501": "DA_Component_BFSword",
    "502": "DA_Component_RecurveBow",
    "503": "DA_Component_NeedlesslyLargeRod",
    "504": "DA_Component_TearOfTheGoddess",
    "505": "DA_Component_ChainVest",
    "506": "DA_Component_NegatronCloak",
    "507": "DA_Component_GiantsBelt",
    "508": "DA_Component_Spatula",
    "509": "DA_Component_SparringGloves",
    "519": "DA_Deathblade",
    "521": "DA_GiantSlayer",
    "525": "DA_SpearOfShojin",
    "529": "DA_Bloodthirster",
    "535": "DA_InfinityEdge",
    "539": "DA_GuinsoosRageblade",
    "551": "DA_LastWhisper",
    "553": "DA_RabadonsDeathcap",
    "555": "DA_ArchangelsStaff",
    "561": "DA_Morellonomicon",
    "565": "DA_JeweledGauntlet",
    "567": "DA_BlueBuff",
    "577": "DA_HandOfJustice",
    "579": "DA_BrambleVest",
    "581": "DA_GargoyleStoneplate",
    "583": "DA_SunfireCape",
    "595": "DA_Quicksilver",
    "597": "DA_WarmogsArmor",
    "607": "DA_ThiefsGloves",
    "608": "DA_TacticiansCrown",
    "609": "DA_DragonsClaw",
    "610": "DA_HextechGunblade",
    "611": "DA_IonicSpark",
    "613": "DA_TitansResolve",
    "615": "DA_EdgeOfNight",
    "616": "DA_ProtectorsVow",
    "617": "DA_StrikersFlail",
    "618": "DA_SteraksGage",
    "619": "DA_NashorsTooth",
    "620": "DA_Crownguard",
    "621": "DA_AdaptiveHelm",
    "623": "DA_Evenshroud",
    "624": "DA_RedBuff",
    "625": "DA_SteadfastHeart",
    "1519": "DA_DeathbladeRadiant",
    "1521": "DA_GiantSlayer_Radiant",
    "1523": "DA_HextechGunbladeRadiant",
    "1525": "DA_SpearOfShojinRadiant",
    "1527": "DA_EdgeOfNightRadiant",
    "1529": "DA_BloodthirsterRadiant",
    "1535": "DA_InfinityEdgeRadiant",
    "1539": "DA_GuinsoosRagebladeRadiant",
    "1543": "DA_TitansResolve_Radiant",
    "1551": "DA_LastWhisperRadiant",
    "1553": "DA_RabadonsDeathcap_Radiant",
    "1555": "DA_ArchangelsStaffRadiant",
    "1559": "DA_IonicSparkRadiant",
    "1561": "DA_MorellonomiconRadiant",
    "1565": "DA_JeweledGauntletRadiant",
    "1567": "DA_BlueBuffRadiant",
    "1577": "DA_HandOfJusticeRadiant",
    "1579": "DA_BrambleVestRadiant",
    "1581": "DA_GargoyleStoneplate_Radiant",
    "1583": "DA_SunfireCape_Radiant",
    "1595": "DA_QuicksilverRadiant",
    "1597": "DA_WarmogsArmorRadiant",
    "1607": "DA_ThiefsGlovesRadiant",
    "1616": "DA_ProtectorsVowRadiant",
    "1617": "DA_StrikersFlailRadiant",
    "1618": "DA_SteraksGageRadiant",
    "1619": "DA_NashorsToothRadiant",
    "1620": "DA_CrownguardRadiant",
    "1621": "DA_AdaptiveHelm_Radiant",
    "1623": "DA_EvenshroudRadiant",
    "1624": "DA_RedBuffRadiant",
    "1625": "DA_SteadfastHeartRadiant",
    "20002": "DA_Artifact_DeathsDefiance",
    "20003": "DA_Artifact_Manazane",
    "20004": "DA_Artifact_InfinityForce",
    "20009": "DA_Artifact_GoldCollector",
    "20010": "DA_Artifact_ZhonyasParadox",
    "20011": "DA_Artifact_Hullcrusher",
    "20017": "DA_Artifact_MogulsMail",
    "20044": "DA_Artifact_Dawncore",
    "20101": "DA_Artifact_GamblersBlade",
    "30002": "DA_Item_Artifact_TalismanOfAscension",
    "30004": "DA_Artifact_Fishbones",
    "30006": "DA_Artifact_HorizonFocus",
    "30007": "DA_Artifact_Mittens",
    "30009": "DA_Artifact_RapidFireCannon",
    "30011": "DA_Artifact_LudensTempest",
    "30012": "DA_Artifact_SilvermereDawn",
    "30013": "TFT_Item_Artifact_ProwlersClaw",
    "30016": "DA_Artifact_BlightingJewel",
    "30017": "DA_Artifact_WitsEnd",
    "30018": "DA_Artifact_ForbiddenIdol",
    "30019": "DA_Artifact_LichBane",
    "30020": "DA_Artifact_LightshieldCrest",
    "30021": "DA_Artifact_SeekersArmguard",
    "30044": "DA_DragonsClawRadiant",
    "31000": "DA_Component_FryingPan",
    "31002": "DA_TacticiansShield",
    "31003": "DA_TacticiansCape",
    "31004": "DA_Artifact_NavoriFlickerblade",
    "31005": "DA_Artifact_StatikkShiv",
    "31006": "DA_Artifact_TitanicHydra",
    "31007": "DA_Artifact_TheIndomitable",
    "31008": "DA_VoidStaff",
    "31009": "DA_VoidStaffRadiant",
    "31010": "DA_KrakensFury",
    "31011": "DA_KrakensFury_Radiant",
    "31012": "DA_SpiritVisage",
    "31013": "DA_SpiritVisage_Radiant",
    "32311": "DA_LuckyItemChest",
    "32312": "TFT_Consumable_RecommendedArmoryRadiant",
    "32314": "DA_SalvagerUpgrade18",
    "32345": "DA_Artifact_VoidGauntlet",
    "32346": "DA_Artifact_AegisOfDawn",
    "32347": "DA_Artifact_HellfireHatchet",
    "32349": "DA_Artifact_AegisOfDusk",
    "32351": "DA_Artifact_EternalPact",
    "32544": "DA_Riftbeast18_Selector",
    "32545": "DA_CUSTOM_1",
    "32546": "DA_CUSTOM_2",
    "33019": "DA_18_EmblemBlossom",
    "33020": "DA_18_EmblemLunar",
    "33021": "DA_18_EmblemSprykin",
    "33022": "DA_18_EmblemFae",
    "33023": "DA_18_EmblemInferno",
    "33024": "DA_18_EmblemElderwood",
    "33025": "DA_18_EmblemBlackthorn",
    "33026": "DA_18_EmblemPrimal",
    "33027": "DA_18_EmblemExecutioner",
    "33028": "DA_18_EmblemBrawler",
    "33029": "DA_18_EmblemInvoker",
    "33030": "DA_18_EmblemRapidfire",
    "33031": "DA_18_EmblemSpellweaver",
    "33032": "DA_18_EmblemVanguard",
    "33033": "DA_18_EmblemHunter",
    "33034": "DA_18_EmblemSlayer",
    "33035": "DA_18_EmblemCoven",
    "33036": "DA_18_EmblemFloraFatalis",
    "33037": "DA_PhantomEmblem18",
    "33038": "DA_18_EmblemDefender",
    "33039": "DA_18_EmblemJuggernaut",
    "33044": "DA_HealthPotion18",
    "33046": "DA_BlastPotion18_Radiant",
    "33047": "DA_18_EmblemFloraFatalisAugment",
    "33051": "DA_ManaPotion18_Radiant",
    "33053": "DA_BlastPotion18",
    "33054": "DA_HealthPotion18_Radiant",
    "33055": "DA_ManaPotion18"
  },
  "19": {
    "501": "DA_Component_BFSword",
    "502": "DA_Component_RecurveBow",
    "503": "DA_Component_NeedlesslyLargeRod",
    "504": "DA_Component_TearOfTheGoddess",
    "505": "DA_Component_ChainVest",
    "506": "DA_Component_NegatronCloak",
    "507": "DA_Component_GiantsBelt",
    "508": "DA_Component_Spatula",
    "509": "DA_Component_SparringGloves",
    "519": "DA_Deathblade",
    "521": "DA_GiantSlayer",
    "525": "DA_SpearOfShojin",
    "529": "DA_Bloodthirster",
    "535": "DA_InfinityEdge",
    "539": "DA_GuinsoosRageblade",
    "551": "DA_LastWhisper",
    "553": "DA_RabadonsDeathcap",
    "555": "DA_ArchangelsStaff",
    "561": "DA_Morellonomicon",
    "565": "DA_JeweledGauntlet",
    "567": "DA_BlueBuff",
    "577": "DA_HandOfJustice",
    "579": "DA_BrambleVest",
    "581": "DA_GargoyleStoneplate",
    "583": "DA_SunfireCape",
    "595": "DA_Quicksilver",
    "597": "DA_WarmogsArmor",
    "607": "DA_ThiefsGloves",
    "608": "DA_TacticiansCrown",
    "609": "DA_DragonsClaw",
    "610": "DA_HextechGunblade",
    "611": "DA_IonicSpark",
    "613": "DA_TitansResolve",
    "615": "DA_EdgeOfNight",
    "616": "DA_ProtectorsVow",
    "617": "DA_StrikersFlail",
    "618": "DA_SteraksGage",
    "619": "DA_NashorsTooth",
    "620": "DA_Crownguard",
    "621": "DA_AdaptiveHelm",
    "623": "DA_Evenshroud",
    "624": "DA_RedBuff",
    "625": "DA_SteadfastHeart",
    "1519": "DA_DeathbladeRadiant",
    "1521": "DA_GiantSlayer_Radiant",
    "1523": "DA_HextechGunbladeRadiant",
    "1525": "DA_SpearOfShojinRadiant",
    "1527": "DA_EdgeOfNightRadiant",
    "1529": "DA_BloodthirsterRadiant",
    "1535": "DA_InfinityEdgeRadiant",
    "1539": "DA_GuinsoosRagebladeRadiant",
    "1543": "DA_TitansResolve_Radiant",
    "1551": "DA_LastWhisperRadiant",
    "1553": "DA_RabadonsDeathcap_Radiant",
    "1555": "DA_ArchangelsStaffRadiant",
    "1559": "DA_IonicSparkRadiant",
    "1561": "DA_MorellonomiconRadiant",
    "1565": "DA_JeweledGauntletRadiant",
    "1567": "DA_BlueBuffRadiant",
    "1577": "DA_HandOfJusticeRadiant",
    "1579": "DA_BrambleVestRadiant",
    "1581": "DA_GargoyleStoneplate_Radiant",
    "1583": "DA_SunfireCape_Radiant",
    "1595": "DA_QuicksilverRadiant",
    "1597": "DA_WarmogsArmorRadiant",
    "1607": "DA_ThiefsGlovesRadiant",
    "1616": "DA_ProtectorsVowRadiant",
    "1617": "DA_StrikersFlailRadiant",
    "1618": "DA_SteraksGageRadiant",
    "1619": "DA_NashorsToothRadiant",
    "1620": "DA_CrownguardRadiant",
    "1621": "DA_AdaptiveHelm_Radiant",
    "1623": "DA_EvenshroudRadiant",
    "1624": "DA_RedBuffRadiant",
    "1625": "DA_SteadfastHeartRadiant",
    "20002": "DA_Artifact_DeathsDefiance",
    "20003": "DA_Artifact_Manazane",
    "20004": "DA_Artifact_InfinityForce",
    "20009": "DA_Artifact_GoldCollector",
    "20010": "DA_Artifact_ZhonyasParadox",
    "20011": "DA_Artifact_Hullcrusher",
    "20017": "DA_Artifact_MogulsMail",
    "20044": "DA_Artifact_Dawncore",
    "20101": "DA_Artifact_GamblersBlade",
    "30002": "DA_Item_Artifact_TalismanOfAscension",
    "30004": "DA_Artifact_Fishbones",
    "30006": "DA_Artifact_HorizonFocus",
    "30007": "DA_Artifact_Mittens",
    "30009": "DA_Artifact_RapidFireCannon",
    "30011": "DA_Artifact_LudensTempest",
    "30012": "DA_Artifact_SilvermereDawn",
    "30013": "TFT_Item_Artifact_ProwlersClaw",
    "30016": "DA_Artifact_BlightingJewel",
    "30017": "DA_Artifact_WitsEnd",
    "30018": "DA_Artifact_ForbiddenIdol",
    "30019": "DA_Artifact_LichBane",
    "30020": "DA_Artifact_LightshieldCrest",
    "30021": "DA_Artifact_SeekersArmguard",
    "30044": "DA_DragonsClawRadiant",
    "31000": "DA_Component_FryingPan",
    "31002": "DA_TacticiansShield",
    "31003": "DA_TacticiansCape",
    "31004": "DA_Artifact_NavoriFlickerblade",
    "31005": "DA_Artifact_StatikkShiv",
    "31006": "DA_Artifact_TitanicHydra",
    "31007": "DA_Artifact_TheIndomitable",
    "31008": "DA_VoidStaff",
    "31009": "DA_VoidStaffRadiant",
    "31010": "DA_KrakensFury",
    "31011": "DA_KrakensFury_Radiant",
    "31012": "DA_SpiritVisage",
    "31013": "DA_SpiritVisage_Radiant",
    "32311": "DA_LuckyItemChest",
    "32312": "TFT_Consumable_RecommendedArmoryRadiant",
    "32314": "DA_SalvagerUpgrade18",
    "32345": "DA_Artifact_VoidGauntlet",
    "32346": "DA_Artifact_AegisOfDawn",
    "32347": "DA_Artifact_HellfireHatchet",
    "32349": "DA_Artifact_AegisOfDusk",
    "32350": "DA_Artifact_CappaJuice",
    "32351": "DA_Artifact_EternalPact",
    "33056": "DA_KDA19_Emblem",
    "33057": "DA_Heartsteel19_Emblem",
    "33058": "DA_Arcanist19_Emblem",
    "33059": "DA_Bodyguard19_Emblem",
    "33060": "DA_IllBeats19_Emblem",
    "33061": "DA_IonicSpark19_Emblem",
    "33062": "DA_DemonVision19_Emblem",
    "33063": "DA_Oceansong19_Emblem",
    "33064": "DA_Pentakill19_Emblem",
    "33065": "DA_Jazz19_Emblem",
    "33066": "DA_TrueDamage19_Emblem",
    "33067": "DA_Swiftstriker19_Emblem",
    "33068": "DA_Renegade19_Emblem",
    "33069": "DA_Virtuosos19_Emblem",
    "33070": "DA_Choreographer19_Emblem",
    "33071": "DA_Juggernaut19_Emblem",
    "33072": "DA_Manager19_Emblem",
    "33073": "DA_Mosher19_Emblem",
    "33074": "DA_Hitmaker19_Emblem",
    "33075": "DA_Frontman19_Emblem",
    "33076": "DA_GlitterBomb19_Emblem",
    "33077": "TFT_Emblem_CHANGEME",
    "33078": "DA_Bard19_UniqueItem",
    "33079": "DA_Heavenscale19_DangerousItem",
    "33080": "DA_RanduinsOmen",
    "33081": "DA_ZZRotPortal",
    "33082": "DA_ZekesHerald",
    "33083": "DA_ChaliceOfPower",
    "33084": "DA_Heavenscale19_HeavenlyPrayer"
  }
}

/** 数字 id → 元信息（apiName / 中文名 / 装备分类 / 出现赛季），供 UI 分组与兜底展示 */
export const EQUIP_META = {
  "501": {
    "apiName": "DA_Component_BFSword",
    "name": "暴风大剑",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "502": {
    "apiName": "DA_Component_RecurveBow",
    "name": "反曲之弓",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "503": {
    "apiName": "DA_Component_NeedlesslyLargeRod",
    "name": "无用大棒",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "504": {
    "apiName": "DA_Component_TearOfTheGoddess",
    "name": "女神之泪",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "505": {
    "apiName": "DA_Component_ChainVest",
    "name": "锁子甲",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "506": {
    "apiName": "DA_Component_NegatronCloak",
    "name": "负极斗篷",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "507": {
    "apiName": "DA_Component_GiantsBelt",
    "name": "巨人腰带",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "508": {
    "apiName": "DA_Component_Spatula",
    "name": "金铲铲",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "509": {
    "apiName": "DA_Component_SparringGloves",
    "name": "拳套",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "519": {
    "apiName": "DA_Deathblade",
    "name": "死亡之刃",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "521": {
    "apiName": "DA_GiantSlayer",
    "name": "巨人杀手",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "525": {
    "apiName": "DA_SpearOfShojin",
    "name": "朔极之矛",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "529": {
    "apiName": "DA_Bloodthirster",
    "name": "饮血剑",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "535": {
    "apiName": "DA_InfinityEdge",
    "name": "无尽之刃",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "539": {
    "apiName": "DA_GuinsoosRageblade",
    "name": "鬼索的狂暴之刃",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "551": {
    "apiName": "DA_LastWhisper",
    "name": "最后的轻语",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "553": {
    "apiName": "DA_RabadonsDeathcap",
    "name": "灭世者的死亡之帽",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "555": {
    "apiName": "DA_ArchangelsStaff",
    "name": "大天使之杖",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "561": {
    "apiName": "DA_Morellonomicon",
    "name": "莫雷洛秘典",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "565": {
    "apiName": "DA_JeweledGauntlet",
    "name": "珠光护手",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "567": {
    "apiName": "DA_BlueBuff",
    "name": "蓝霸符",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "577": {
    "apiName": "DA_HandOfJustice",
    "name": "正义之手",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "579": {
    "apiName": "DA_BrambleVest",
    "name": "棘刺背心",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "581": {
    "apiName": "DA_GargoyleStoneplate",
    "name": "石像鬼石板甲",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "583": {
    "apiName": "DA_SunfireCape",
    "name": "日炎斗篷",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "595": {
    "apiName": "DA_Quicksilver",
    "name": "水银",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "597": {
    "apiName": "DA_WarmogsArmor",
    "name": "狂徒铠甲",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "607": {
    "apiName": "DA_ThiefsGloves",
    "name": "窃贼手套",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "608": {
    "apiName": "DA_TacticiansCrown",
    "name": "金铲铲冠冕",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "609": {
    "apiName": "DA_DragonsClaw",
    "name": "巨龙之爪",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "610": {
    "apiName": "DA_HextechGunblade",
    "name": "海克斯科技枪刃",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "611": {
    "apiName": "DA_IonicSpark",
    "name": "离子火花",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "613": {
    "apiName": "DA_TitansResolve",
    "name": "泰坦的坚决",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "615": {
    "apiName": "DA_EdgeOfNight",
    "name": "夜之锋刃",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "616": {
    "apiName": "DA_ProtectorsVow",
    "name": "圣盾使的誓约",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "617": {
    "apiName": "DA_StrikersFlail",
    "name": "强袭者的链枷",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "618": {
    "apiName": "DA_SteraksGage",
    "name": "斯特拉克的挑战护手",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "619": {
    "apiName": "DA_NashorsTooth",
    "name": "纳什之牙",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "620": {
    "apiName": "DA_Crownguard",
    "name": "冕卫",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "621": {
    "apiName": "DA_AdaptiveHelm",
    "name": "适应性头盔",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "623": {
    "apiName": "DA_Evenshroud",
    "name": "薄暮法袍",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "624": {
    "apiName": "DA_RedBuff",
    "name": "红霸符",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "625": {
    "apiName": "DA_SteadfastHeart",
    "name": "坚定之心",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1519": {
    "apiName": "DA_DeathbladeRadiant",
    "name": "光明版死亡之刃",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1521": {
    "apiName": "DA_GiantSlayer_Radiant",
    "name": "光明版巨人杀手",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1523": {
    "apiName": "DA_HextechGunbladeRadiant",
    "name": "光明版海克斯科技枪刃",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1525": {
    "apiName": "DA_SpearOfShojinRadiant",
    "name": "光明版朔极之矛",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1527": {
    "apiName": "DA_EdgeOfNightRadiant",
    "name": "光明版夜之锋刃",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1529": {
    "apiName": "DA_BloodthirsterRadiant",
    "name": "光明版饮血剑",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1535": {
    "apiName": "DA_InfinityEdgeRadiant",
    "name": "光明版无尽之刃",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1539": {
    "apiName": "DA_GuinsoosRagebladeRadiant",
    "name": "光明版鬼索的狂暴之刃",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1543": {
    "apiName": "DA_TitansResolve_Radiant",
    "name": "光明版泰坦的坚决",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1551": {
    "apiName": "DA_LastWhisperRadiant",
    "name": "光明版最后的轻语",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1553": {
    "apiName": "DA_RabadonsDeathcap_Radiant",
    "name": "光明版灭世者的死亡之帽",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1555": {
    "apiName": "DA_ArchangelsStaffRadiant",
    "name": "光明版大天使之杖",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1559": {
    "apiName": "DA_IonicSparkRadiant",
    "name": "光明版离子火花",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1561": {
    "apiName": "DA_MorellonomiconRadiant",
    "name": "光明版莫雷洛秘典",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1565": {
    "apiName": "DA_JeweledGauntletRadiant",
    "name": "光明版珠光护手",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1567": {
    "apiName": "DA_BlueBuffRadiant",
    "name": "光明版蓝霸符",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1577": {
    "apiName": "DA_HandOfJusticeRadiant",
    "name": "光明版正义之手",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1579": {
    "apiName": "DA_BrambleVestRadiant",
    "name": "光明版棘刺背心",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1581": {
    "apiName": "DA_GargoyleStoneplate_Radiant",
    "name": "光明版石像鬼石板甲",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1583": {
    "apiName": "DA_SunfireCape_Radiant",
    "name": "光明版日炎斗篷",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1595": {
    "apiName": "DA_QuicksilverRadiant",
    "name": "光明版水银",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1597": {
    "apiName": "DA_WarmogsArmorRadiant",
    "name": "光明版狂徒铠甲",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1607": {
    "apiName": "DA_ThiefsGlovesRadiant",
    "name": "光明版窃贼手套",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1616": {
    "apiName": "DA_ProtectorsVowRadiant",
    "name": "光明版圣盾使的誓约",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1617": {
    "apiName": "DA_StrikersFlailRadiant",
    "name": "光明版强袭者的链枷",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1618": {
    "apiName": "DA_SteraksGageRadiant",
    "name": "光明版斯特拉克的挑战护手",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1619": {
    "apiName": "DA_NashorsToothRadiant",
    "name": "光明版纳什之牙",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1620": {
    "apiName": "DA_CrownguardRadiant",
    "name": "光明版冕卫",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1621": {
    "apiName": "DA_AdaptiveHelm_Radiant",
    "name": "光明版适应性头盔",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1623": {
    "apiName": "DA_EvenshroudRadiant",
    "name": "光明版薄暮法袍",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1624": {
    "apiName": "DA_RedBuffRadiant",
    "name": "光明版红霸符",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "1625": {
    "apiName": "DA_SteadfastHeartRadiant",
    "name": "光明版坚定之心",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20002": {
    "apiName": "DA_Artifact_DeathsDefiance",
    "name": "死亡蔑视",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20003": {
    "apiName": "DA_Artifact_Manazane",
    "name": "魔蕴",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20004": {
    "apiName": "DA_Artifact_InfinityForce",
    "name": "三相之力",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20009": {
    "apiName": "DA_Artifact_GoldCollector",
    "name": "金币收集者",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20010": {
    "apiName": "DA_Artifact_ZhonyasParadox",
    "name": "中娅悖论",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20011": {
    "apiName": "DA_Artifact_Hullcrusher",
    "name": "碎舰者",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20017": {
    "apiName": "DA_Artifact_MogulsMail",
    "name": "大亨之铠",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20044": {
    "apiName": "DA_Artifact_Dawncore",
    "name": "黎明核心",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "20101": {
    "apiName": "DA_Artifact_GamblersBlade",
    "name": "投机者之刃",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30002": {
    "apiName": "DA_Item_Artifact_TalismanOfAscension",
    "name": "飞升护符",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30004": {
    "apiName": "DA_Artifact_Fishbones",
    "name": "鱼骨头",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30006": {
    "apiName": "DA_Artifact_HorizonFocus",
    "name": "视界专注",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30007": {
    "apiName": "DA_Artifact_Mittens",
    "name": "连指手套",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30009": {
    "apiName": "DA_Artifact_RapidFireCannon",
    "name": "疾射火炮",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30011": {
    "apiName": "DA_Artifact_LudensTempest",
    "name": "卢登的激荡",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30012": {
    "apiName": "DA_Artifact_SilvermereDawn",
    "name": "密银黎明",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30013": {
    "apiName": "TFT_Item_Artifact_ProwlersClaw",
    "name": "暗行者之爪",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30016": {
    "apiName": "DA_Artifact_BlightingJewel",
    "name": "枯萎珠宝",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30017": {
    "apiName": "DA_Artifact_WitsEnd",
    "name": "智慧末刃",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30018": {
    "apiName": "DA_Artifact_ForbiddenIdol",
    "name": "禁忌雕像",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30019": {
    "apiName": "DA_Artifact_LichBane",
    "name": "巫妖之祸",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30020": {
    "apiName": "DA_Artifact_LightshieldCrest",
    "name": "光盾徽章",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30021": {
    "apiName": "DA_Artifact_SeekersArmguard",
    "name": "探索者的护臂",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "30044": {
    "apiName": "DA_DragonsClawRadiant",
    "name": "光明版巨龙之爪",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31000": {
    "apiName": "DA_Component_FryingPan",
    "name": "金锅锅",
    "type2": "part",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31002": {
    "apiName": "DA_TacticiansShield",
    "name": "金锅锅冠冕",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31003": {
    "apiName": "DA_TacticiansCape",
    "name": "金锅铲冠冕",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31004": {
    "apiName": "DA_Artifact_NavoriFlickerblade",
    "name": "纳沃利烁刃",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31005": {
    "apiName": "DA_Artifact_StatikkShiv",
    "name": "斯塔缇克电刃",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31006": {
    "apiName": "DA_Artifact_TitanicHydra",
    "name": "巨型九头蛇",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31007": {
    "apiName": "DA_Artifact_TheIndomitable",
    "name": "顽强不屈",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31008": {
    "apiName": "DA_VoidStaff",
    "name": "虚空之杖",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31009": {
    "apiName": "DA_VoidStaffRadiant",
    "name": "光明版虚空之杖",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31010": {
    "apiName": "DA_KrakensFury",
    "name": "海妖之怒",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31011": {
    "apiName": "DA_KrakensFury_Radiant",
    "name": "光明版海妖之怒",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31012": {
    "apiName": "DA_SpiritVisage",
    "name": "振奋盔甲",
    "type2": "common",
    "seasons": [
      "18",
      "19"
    ]
  },
  "31013": {
    "apiName": "DA_SpiritVisage_Radiant",
    "name": "光明版振奋盔甲",
    "type2": "guangming",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32311": {
    "apiName": "DA_LuckyItemChest",
    "name": "幸运装备宝箱",
    "type2": "remove",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32312": {
    "apiName": "TFT_Consumable_RecommendedArmoryRadiant",
    "name": "光明版幸运装备宝箱",
    "type2": "remove",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32314": {
    "apiName": "DA_SalvagerUpgrade18",
    "name": "打捞术",
    "type2": "remove",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32345": {
    "apiName": "DA_Artifact_VoidGauntlet",
    "name": "虚空护手",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32346": {
    "apiName": "DA_Artifact_AegisOfDawn",
    "name": "黎明圣盾",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32347": {
    "apiName": "DA_Artifact_HellfireHatchet",
    "name": "恶火小斧",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32349": {
    "apiName": "DA_Artifact_AegisOfDusk",
    "name": "黄昏圣盾",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32350": {
    "apiName": "DA_Artifact_CappaJuice",
    "name": "帽子饮品",
    "type2": "aoen",
    "seasons": [
      "19"
    ]
  },
  "32351": {
    "apiName": "DA_Artifact_EternalPact",
    "name": "永恒契约",
    "type2": "aoen",
    "seasons": [
      "18",
      "19"
    ]
  },
  "32544": {
    "apiName": "DA_Riftbeast18_Selector",
    "name": "阿尔法印记",
    "type2": "daoju",
    "seasons": [
      "18"
    ]
  },
  "32545": {
    "apiName": "DA_CUSTOM_1",
    "name": "毛绒绒大朋友",
    "type2": "daoju",
    "seasons": [
      "18"
    ]
  },
  "32546": {
    "apiName": "DA_CUSTOM_2",
    "name": "毛绒绒大朋友",
    "type2": "daoju",
    "seasons": [
      "18"
    ]
  },
  "33019": {
    "apiName": "DA_18_EmblemBlossom",
    "name": "灵魂莲华纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33020": {
    "apiName": "DA_18_EmblemLunar",
    "name": "月蚀骑士纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33021": {
    "apiName": "DA_18_EmblemSprykin",
    "name": "约德尔人和朋友纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33022": {
    "apiName": "DA_18_EmblemFae",
    "name": "花仙子纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33023": {
    "apiName": "DA_18_EmblemInferno",
    "name": "地狱火纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33024": {
    "apiName": "DA_18_EmblemElderwood",
    "name": "永恒之森纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33025": {
    "apiName": "DA_18_EmblemBlackthorn",
    "name": "黑荆棘纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33026": {
    "apiName": "DA_18_EmblemPrimal",
    "name": "野兽之灵纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "18"
    ]
  },
  "33027": {
    "apiName": "DA_18_EmblemExecutioner",
    "name": "裁决使纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33028": {
    "apiName": "DA_18_EmblemBrawler",
    "name": "斗士纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33029": {
    "apiName": "DA_18_EmblemInvoker",
    "name": "神谕纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33030": {
    "apiName": "DA_18_EmblemRapidfire",
    "name": "迅捷射手纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33031": {
    "apiName": "DA_18_EmblemSpellweaver",
    "name": "法师纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33032": {
    "apiName": "DA_18_EmblemVanguard",
    "name": "重装战士纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33033": {
    "apiName": "DA_18_EmblemHunter",
    "name": "猎人纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33034": {
    "apiName": "DA_18_EmblemSlayer",
    "name": "狂战士纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "18"
    ]
  },
  "33035": {
    "apiName": "DA_18_EmblemCoven",
    "name": "魔女纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "18"
    ]
  },
  "33036": {
    "apiName": "DA_18_EmblemFloraFatalis",
    "name": "绝命花妖纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "18"
    ]
  },
  "33037": {
    "apiName": "DA_PhantomEmblem18",
    "name": "幻影纹章",
    "type2": "remove",
    "seasons": [
      "18"
    ]
  },
  "33038": {
    "apiName": "DA_18_EmblemDefender",
    "name": "护卫纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "18"
    ]
  },
  "33039": {
    "apiName": "DA_18_EmblemJuggernaut",
    "name": "主宰纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "18"
    ]
  },
  "33044": {
    "apiName": "DA_HealthPotion18",
    "name": "生命药水",
    "type2": "other",
    "seasons": [
      "18"
    ]
  },
  "33046": {
    "apiName": "DA_BlastPotion18_Radiant",
    "name": "光明版爆炸药水",
    "type2": "other",
    "seasons": [
      "18"
    ]
  },
  "33047": {
    "apiName": "DA_18_EmblemFloraFatalisAugment",
    "name": "绝命花妖纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "18"
    ]
  },
  "33051": {
    "apiName": "DA_ManaPotion18_Radiant",
    "name": "光明版法力药水",
    "type2": "other",
    "seasons": [
      "18"
    ]
  },
  "33053": {
    "apiName": "DA_BlastPotion18",
    "name": "爆炸药水",
    "type2": "other",
    "seasons": [
      "18"
    ]
  },
  "33054": {
    "apiName": "DA_HealthPotion18_Radiant",
    "name": "光明版生命药水",
    "type2": "other",
    "seasons": [
      "18"
    ]
  },
  "33055": {
    "apiName": "DA_ManaPotion18",
    "name": "法力药水",
    "type2": "other",
    "seasons": [
      "18"
    ]
  },
  "33056": {
    "apiName": "DA_KDA19_Emblem",
    "name": "K/DA纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33057": {
    "apiName": "DA_Heartsteel19_Emblem",
    "name": "心之钢纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33058": {
    "apiName": "DA_Arcanist19_Emblem",
    "name": "法师纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33059": {
    "apiName": "DA_Bodyguard19_Emblem",
    "name": "护卫纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33060": {
    "apiName": "DA_IllBeats19_Emblem",
    "name": "大触打击乐纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33061": {
    "apiName": "DA_IonicSpark19_Emblem",
    "name": "离子火花纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33062": {
    "apiName": "DA_DemonVision19_Emblem",
    "name": "摇滚恶魔纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33063": {
    "apiName": "DA_Oceansong19_Emblem",
    "name": "海之歌纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33064": {
    "apiName": "DA_Pentakill19_Emblem",
    "name": "五杀乐队纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33065": {
    "apiName": "DA_Jazz19_Emblem",
    "name": "爵士乐纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "19"
    ]
  },
  "33066": {
    "apiName": "DA_TrueDamage19_Emblem",
    "name": "真实伤害纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "19"
    ]
  },
  "33067": {
    "apiName": "DA_Swiftstriker19_Emblem",
    "name": "迅击鼓手纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33068": {
    "apiName": "DA_Renegade19_Emblem",
    "name": "非主流纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33069": {
    "apiName": "DA_Virtuosos19_Emblem",
    "name": "古典乐纹章",
    "type2": "zhuanzhi",
    "seasons": [
      "19"
    ]
  },
  "33070": {
    "apiName": "DA_Choreographer19_Emblem",
    "name": "编舞师纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "19"
    ]
  },
  "33071": {
    "apiName": "DA_Juggernaut19_Emblem",
    "name": "主宰纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "19"
    ]
  },
  "33072": {
    "apiName": "DA_Manager19_Emblem",
    "name": "经纪人纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "19"
    ]
  },
  "33073": {
    "apiName": "DA_Mosher19_Emblem",
    "name": "舞者纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33074": {
    "apiName": "DA_Hitmaker19_Emblem",
    "name": "音乐制作人纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33075": {
    "apiName": "DA_Frontman19_Emblem",
    "name": "主唱纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33076": {
    "apiName": "DA_GlitterBomb19_Emblem",
    "name": "高能流行纹章",
    "type2": "zhuanzhi2",
    "seasons": [
      "19"
    ]
  },
  "33077": {
    "apiName": "TFT_Emblem_CHANGEME",
    "name": "天才纹章",
    "type2": "zhuanzhiJgg",
    "seasons": [
      "19"
    ]
  },
  "33078": {
    "apiName": "DA_Bard19_UniqueItem",
    "name": "巴德的旅者号角",
    "type2": "other",
    "seasons": [
      "19"
    ]
  },
  "33079": {
    "apiName": "DA_Heavenscale19_DangerousItem",
    "name": "异兽绘卷",
    "type2": "other",
    "seasons": [
      "19"
    ]
  },
  "33080": {
    "apiName": "DA_RanduinsOmen",
    "name": "兰顿之兆",
    "type2": "other",
    "seasons": [
      "19"
    ]
  },
  "33081": {
    "apiName": "DA_ZZRotPortal",
    "name": "兹若特传送门",
    "type2": "other",
    "seasons": [
      "19"
    ]
  },
  "33082": {
    "apiName": "DA_ZekesHerald",
    "name": "基克的先驱",
    "type2": "other",
    "seasons": [
      "19"
    ]
  },
  "33083": {
    "apiName": "DA_ChaliceOfPower",
    "name": "能量圣杯",
    "type2": "other",
    "seasons": [
      "19"
    ]
  },
  "33084": {
    "apiName": "DA_Heavenscale19_HeavenlyPrayer",
    "name": "天祈绘卷",
    "type2": "other",
    "seasons": [
      "19"
    ]
  }
}

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

/**
 * 数字装备 id → 装备 apiName。
 * @param {string|number} id dataTFT 返回的数字 id（字符串或数字均可）
 * @param {string|number|null} [season] 赛季（"18"/"19"）；给了就先查该赛季表，未命中回落合并表
 * @returns {string|null} apiName，查不到返回 null
 */
export function mapEquipId(id, season = null) {
  if (id === null || id === undefined) return null
  const key = String(id).trim()
  if (!key) return null
  if (season !== null && season !== undefined) {
    const table = EQUIP_MAP_BY_SEASON[String(season)]
    if (table && has(table, key)) return table[key]
  }
  return has(EQUIP_MAP, key) ? EQUIP_MAP[key] : null
}

/**
 * 批量映射，保持输入顺序。
 * @param {Array<string|number>} ids
 * @param {string|number|null} [season]
 * @returns {Array<string|null>}
 */
export function mapEquipIds(ids, season = null) {
  if (!Array.isArray(ids)) return []
  return ids.map((id) => mapEquipId(id, season))
}

/**
 * 数字装备 id → 元信息。
 * @param {string|number} id
 * @param {string|number|null} [season]
 * @returns {{apiName: string, name: string|null, type2: string|null, seasons: string[]}|null}
 */
export function getEquipMeta(id, season = null) {
  const apiName = mapEquipId(id, season)
  if (!apiName) return null
  const key = String(id).trim()
  const meta = EQUIP_META[key]
  return meta ? { ...meta, apiName } : { apiName, name: null, type2: null, seasons: [] }
}

export default { DATATFT_DATA_VERSION, EQUIP_SEASONS, EQUIP_MAP, EQUIP_MAP_BY_SEASON, EQUIP_META, mapEquipId, mapEquipIds, getEquipMeta }
