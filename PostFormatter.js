/* eslint-disable object-property-newline */
// ==UserScript==
// @name         Post Formatter
// @description  Format upload info and smilies
// @version      1.3.2.1
// @author       Anonymous inspired by Secant(TYT@NexusHD)
// @match        *.nexushd.org/*
// @match        pterclub.com/*
// @match        pt.sjtu.edu.cn/*
// @match        kp.m-team.cc/*
// @match        totheglory.im/*
// @match        greatposterwall.com/*
// @match        uhdbits.org/*
// @grant        GM_xmlhttpRequest
// @require      https://cdn.staticfile.org/jquery/2.1.4/jquery.js
// @require      https://code.jquery.com/jquery-migrate-1.0.0.js
// @icon         http://www.nexushd.org/favicon.ico
// @namespace    d8e7078b-abee-407d-bcb6-096b59eeac17
// @license      MIT
// ==/UserScript==
//= ========================================================================================================
// constants
const $ = window.jQuery
const NHD = 'NHD'; const PTER = 'PTER'; const PUTAO = 'PUTAO'; const MTEAM = 'MTEAM'; const TTG = 'TTG'
const GPW = 'GPW'; const UHD = 'UHD'
const NEXUSPHP = 'nexusphp'; const GAZELLE = 'gazelle'
const PIXHOST = 'pixhost'; const IMGBOX = 'imghost'; const IMG4K = 'img4k'
const PTERCLUB = 'pterclub'; const IMGPILE = 'imgpile'; const PTPIMG = 'ptpimg'
// compare with comparison (GPW style)
const regexTeam = /\b(?:(?:\w[\w()-. ]+)|(?:D-Z0N3)|(?:de\[42\]))/i
const regexTeamsSplitter = /\||,|\/|-|>?\s*vs\.?\s*<?/i
const regexNormalUrl = /[A-Za-z0-9\-._~!$&'()*+;=:@/?]+/i
const regexImageUrl = RegExp(
  'https?:' + regexNormalUrl.source + '?\\.(?:png|jpg)',
  'i')
// const regexScreenshotsComparison = /\[comparison=(\b\w[\w()-.[\] ]+\s*(,\s*\b\w[\w()-.[\] ]+?)+)\](\s*([^, [\]]+(\s+|\s*,)\s*)+[^, [\]]+)\[\/comparison\]/mi
const regexScreenshotsComparison = RegExp(
  '\\[comparison=(' +
  regexTeam.source + '\\s*(?:,\\s*' + regexTeam.source +
  '?)+)\\](\\s*(?:' +
  regexImageUrl.source + '(?:\\s+|\\s*,)\\s*)+' + regexImageUrl.source +
  ')\\s*\\[\\/comparison\\]',
  'mig')
// compare with thumbs
// const regexScreenshotsThumbs = /(\s*(\[url=[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+?\])?\[img\][A-Za-z0-9\-._~!$&'()*+,;=:@/?]+?\[\/img\](\[\/url\])?\s*)+/mi
const regexScreenshotsThumbsCombined = RegExp(
  '((?:\\s*(\\[url=' +
  regexNormalUrl.source + '?\\])?\\s*\\[img\\]' +
  regexImageUrl.source + '?\\[\\/img\\]\\s*(?:\\[\\/url\\])?\\s*)+)',
  'mi')
const regexScreenshotsThumbsSeparated = RegExp(
  '(\\[url=' +
  regexNormalUrl.source + '?\\])?\\s*\\[img\\]' +
  regexImageUrl.source + '?\\[\\/img\\]\\s*(?:\\[\\/url\\])?',
  'mig')
const regexImageUrlsSeparated = RegExp(
  '(' + regexImageUrl.source + ')',
  'mig')
// 两种截图模式，第一种是包含[box|hide|expand|spoiler|quote=]标签的
// possible splitters for teams: '|',',','/','-','vs'
// const regexScreenshotsThumbsBoxed = /\[(box|hide|expand|spoiler|quote)\s*=\s*(\b\w[\w()-.[\] ]+(\s*(\||,|\/|-|>?\s*vs\.?\s*<?)\s*\b\w[\w()-.[\] ]+)+)\]((\s*(\[url=[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+?\])?\[img\][A-Za-z0-9\-._~!$&'()*+,;=:@/?]+?\[\/img\](\[\/url\])?\s*)+)\[\/\1\]/mi
const regexScreenshotsThumbsBoxed = RegExp(
  '\\[(box|hide|expand|spoiler|quote)\\s*=\\s*(' +
  regexTeam.source + '(?:\\s*(?:' + regexTeamsSplitter.source + ')\\s*' + regexTeam.source +
  ')+)\\]' +
  regexScreenshotsThumbsCombined.source +
  '\\s*\\[\\/\\1\\]',
  'mig')
// 第二种不包含[box|hide|expand|spoiler|quote=]标签，要求Source, Encode与截图之间至少有一个换行符
const regexScreenshotsThumbsTitled = RegExp(
  '^\\W*(' +
  regexTeam.source + '(?:\\s*(?:' + regexTeamsSplitter.source + ')\\s*' + regexTeam.source +
  ')+)[\\W]*\\n+\\s*' +
  regexScreenshotsThumbsCombined.source,
  'mig')
const regexScreenshotsSimple = RegExp(
  '(?:\\[b\\])?Screenshots(?:\\[\\/b\\])?\\s*(\\[img\\]' + regexImageUrl + '\\s*\\[\\/img\\]+)',
  'mig')
const regexInfo = {
  boxed: { regex: regexScreenshotsThumbsBoxed, groupForTeams: 2, groupForUrls: 3, groupForThumbs: 4 },
  titled: { regex: regexScreenshotsThumbsTitled, groupForTeams: 1, groupForUrls: 2, groupForThumbs: 3 },
  comparison: { regex: regexScreenshotsComparison, groupForTeams: 1, groupForUrls: 2, groupForThumbs: -1 },
  simple: { regex: regexScreenshotsSimple, groupForTeams: -1, groupForUrls: 1, groupForThumbs: -1 }
}
const siteInfoMap = {
  NHD: {
    construct: NEXUSPHP,
    targetTagBox: 'box',
    boxSupportDescr: true,
    otherTagBoxes: ['hide', 'spoiler', 'expand'].join('|'),
    unsupportedTags: ['align'].join('|'),
    decodingMediainfo: false,

    inputFile: $('input[type="file"][name="file"]'),
    nameBoxUpload: $('#name'), nameBoxEdit: $("input[type='text'][name='name']"), anonymousControl: $("input[name='uplver'][type='checkbox']")[0],
    descrBox: $('#descr'), smallDescBox: $("input[name='small_descr']"),
    imdbLinkBox: $("input[name='url'][type='text']"), doubanLinkBox: $("input[name='douban_url']"),
    categorySel: $('#browsecat'), sourceSel: $("select[name='source_sel']"), standardSel: $("select[name='standard_sel']"), processingSel: $("select[name='processing_sel']"), codecSel: $("select[name='codec_sel']"),

    pullMovieScore: false, translatedChineseNameInTitle: false, doubanIdInsteadofLink: false,
    categoryInfo: { default: 0, movie: 101, tvSeries: 102, tvShow: 103, documentary: 104, animation: 105 },
    sourceInfo: { default: 0, bluray: 1, hddvd: 2, dvd: 3, hdtv: 4, webdl: 7, webrip: 9 },
    standardInfo: { default: 0, res1080p: 1, res1080i: 2, res720p: 3, res2160p: 6, sd: 4 },
    processingInfo: { default: 0, raw: 1, encode: 2 },
    codecInfo: { default: 0, h264: 1, h265: 2, vc1: 3, xvid: 4, mpeg2: 5, flac: 10, ape: 11 }
  },
  PTER: {
    construct: NEXUSPHP,
    targetBoxTag: 'hide',
    boxSupportDescr: true,
    otherTagBoxes: ['box', 'spoiler', 'expand'].join('|'),
    unsupportedTags: ['align'].join('|'),
    decodingMediainfo: true,

    inputFile: $('input[type="file"][name="file"]'), nameBoxUpload: $('#name'), nameBoxEdit: $("input[type='text'][name='name']"),
    anonymousControl: $("input[name='uplver'][type='checkbox']")[0],
    descrBox: $('#descr'), smallDescBox: $("input[name='small_descr']"),
    imdbLinkBox: $("input[name='url'][type='text']"), doubanLinkBox: $("input[name='douban']"),
    categorySel: $('#browsecat'), sourceSel: $("select[name='source_sel']"), areaSel: $("select[name='team_sel']"),
    chsubCheck: $('#zhongzi')[0], englishSubCheck: $('#ensub')[0], chdubCheck: $('#guoyu')[0], cantodubCheck: $('#yueyu')[0],

    pullMovieScore: true, translatedChineseNameInTitle: false, doubanIdInsteadofLink: false,
    categoryInfo: { default: 0, movie: 401, tvSeries: 404, tvShow: 405, documentary: 402, animation: 403 },
    sourceInfo: { default: 0, bluray: 2, remux: 3, encode: 6, hdtv: 4, webdl: 5, dvd: 7 },
    areaInfo: { default: 0, cnMl: 1, hk: 2, tw: 3, euAme: 4, kor: 5, jap: 6, ind: 7, other: 8 }
  },
  PUTAO: {
    construct: NEXUSPHP,
    targetTagBox: '',
    boxSupportDescr: true,
    otherTagBoxes: ['box', 'hide', 'spoiler', 'expand'].join('|'),
    unsupportedTags: ['align', 'center'].join('|'),
    decodingMediainfo: false,

    inputFile: $('input[type="file"][name="file"]'), nameBoxUpload: $('#name'), nameBoxEdit: $("input[type='text'][name='name']"),
    anonymousControl: $("input[name='uplver'][type='checkbox']")[0],
    descrBox: $('#descr'), smallDescBox: $("input[name='small_descr']"),
    imdbLinkBox: $("input[name='url'][type='text']"), doubanLinkBox: $("input[name='douban_url']"),
    categorySel: $('#browsecat'), standardSel: $("select[name='standard_sel']"), codecSel: $("select[name='codec_sel']"),

    pullMovieScore: false, translatedChineseNameInTitle: true, doubanIdInsteadofLink: false,
    categoryInfo: {
      default: 0, documentary: 406, animation: 431, movieCn: 401, movieEuAme: 402, movieAsia: 403,
      tvSeriesHkTw: 407, tvSeriesAsia: 408, tvSeriesCnMl: 409, tvSeriesEuAme: 410,
      catTvShowCnMl: 411, tvShowHkTw: 412, tvShowEuAme: 413, tvshowJapKor: 414
    },
    standardInfo: { default: 0, res1080p: 1, res1080i: 2, res720p: 3, res2160p: 6, sd: 4 },
    codecInfo: { default: 0, h264: 1, vc1: 2, xvid: 3, mpeg2: 4, flac: 5, ape: 6, h265: 10 }
  },
  MTEAM: {
    construct: NEXUSPHP,
    targetTagBox: 'expand',
    boxSupportDescr: false,
    otherTagBoxes: ['box', 'hide', 'spoiler'].join('|'),
    unsupportedTags: ['align'].join('|'),
    decodingMediainfo: true,

    inputFile: $('input[type="file"][name="file"]'), nameBoxUpload: $('#name'), nameBoxEdit: $("input[type='text'][name='name']"),
    anonymousControl: $("input[name='uplver'][type='checkbox']")[0],
    descrBox: $('#descr'), smallDescBox: $("input[name='small_descr']"),
    imdbLinkBox: $("input[name='url'][type='text']"),
    categorySel: $('#browsecat'), teamSel: $("select[name='team_sel']"), standardSel: $("select[name='standard_sel']"), areaSel: $("select[name='processing_sel']"), codecSel: $("select[name='codec_sel']"),
    chsubCheck: $("input[type='checkbox'][name='l_sub']")[0], chdubCheck: $("input[type='checkbox'][name='l_dub']")[0],

    pullMovieScore: true, translatedChineseNameInTitle: false, doubanIdInsteadofLink: false,
    categoryInfo: { default: 0, movieHd: 419, movieRemux: 439, tvSeriesHd: 402, documentary: 404, animation: 405 },
    areaInfo: { default: 0, cnMl: 1, euAme: 2, hkTw: 3, jap: 4, kor: 5, other: 6 },
    standardInfo: { default: 0, res1080p: 1, res1080i: 2, res720p: 3, res2160p: 6, sd: 5 },
    codecInfo: { default: 0, h264: 1, vc1: 2, h265: 16, xvid: 3, mpeg2: 4, flac: 5, ape: 10 }
  },
  TTG: {
    construct: NEXUSPHP,
    targetTagBox: '',
    boxSupportDescr: false,
    otherTagBoxes: ['box', 'hide', 'spoiler', 'expand'].join('|'),
    unsupportedTags: ['align'].join('|'),
    decodeMediaInfo: true,

    inputFile: $('input[type="file"][name="file"]'), nameBoxUpload: $("input[type='text'][name='name']"), nameBoxEdit: $("input[type='text'][name='name']"),
    descrBox: $('textarea[name="descr"]'), smallDescBox: $("input[type='text'][name='subtitle']"), subtitleBox: $("input[type='text'][name='highlight']"),
    imdbLinkBox: $("input[name='imdb_c'][type='text']"), doubanLinkBox: $("input[name='douban_id'][type='text']"),
    categorySel: $('select[name="type"]'), anonymousControl: $('select[name="anonymity"]'),

    pullMovieScore: true, translatedChineseNameInTitle: false, doubanIdInsteadofLink: true,
    categoryInfo: {
      default: 0, movie720P: 52, movie1080ip: 53, movie2160p: 108, documentary720p: 62, documentary1080ip: 63,
      tvSeriesEuAme: 87, tvSeriesJap: 88, tvSeriesKor: 99, tvSeriesCn: 90, tvShowJap: 101, tvShowKor: 103, tvShow: 60
    }
  },
  GPW: {
    construct: GAZELLE,
    targetTagBox: 'hide',
    boxSupportDescr: true,
    otherTagBoxes: ['box', 'spoiler', 'expand'].join('|'),
    unsupportedTags: ['align'].join('|'),
    decodingMediainfo: true,

    inputFile: $('#file'),
    mediainfoBox: $('textarea[name="mediainfo[]"]'), descrBox: $('#release_desc'),
    sourceSel: $('select[id="source"]'), codecSel: $('select[id="codec"]'), standardSel: $('select[id="resolution"]'), processingSel: $('select[id="processing"]'), containerSel: $('select[id="container"]'),
    videoInfo: {
      bit10: $('input[type="checkbox"][id="10_bit"]')[0],
      hdr10: $('input[type="checkbox"][id="hdr10"]')[0],
      hdr10plus: $('input[type="checkbox"][id="hdr10plus"]')[0],
      dovi: $('input[type="checkbox"][id="dolby_vision"]')[0]
    },
    movieEditionCheck: $('input[type="checkbox"][id="movie_edition_information"]')[0],
    movieEditionInfo: {
      commentaryAudio: $("a:contains('评论音轨')")[0],
      directorCut: $("a:contains('导演剪辑版')")[0],
      criterionCollection: $("a:contains('标准收藏')")[0],
      theatrical: $("a:contains('影院版')")[0],
      uncut: $("a:contains('未删减版')")[0],
      unrated: $("a:contains('未分级版')")[0],
      extended: $("a:contains('加长版')")[0]
    },
    chdubCheck: $('input[type="checkbox"][id="chinese_dubbed"]')[0],
    mixedSubCheck: $('input[type="radio"][id="mixed_subtitles"]')[0],
    noSubCheck: $('input[type="radio"][id="no_subtitles"]')[0],
    otherSubtitlesDiv: $('div[id="other_subtitles"]'),
    subtitleInfo: {
      chinese_simplified: $('input[type="checkbox"][id="chinese_simplified"]')[0],
      chinese_traditional: $('input[type="checkbox"][id="chinese_traditional"]')[0],
      english: $('input[type="checkbox"][id="english"]')[0],
      japanese: $('input[type="checkbox"][id="japanese"]')[0],
      korean: $('input[type="checkbox"][id="korean"]')[0],
      french: $('input[type="checkbox"][id="french"]')[0],
      german: $('input[type="checkbox"][id="german"]')[0],
      italian: $('input[type="checkbox"][id="italian"]')[0],
      polish: $('input[type="checkbox"][id="polish"]')[0],
      romanian: $('input[type="checkbox"][id="romanian"]')[0],
      russian: $('input[type="checkbox"][id="russian"]')[0],
      spanish: $('input[type="checkbox"][id="spanish"]')[0],
      thai: $('input[type="checkbox"][id="thai"]')[0],
      turkish: $('input[type="checkbox"][id="turkish"]')[0],
      vietnamese: $('input[type="checkbox"][id="vietnamese"]')[0],
      hindi: $('input[type="checkbox"][id="hindi"]')[0],
      greek: $('input[type="checkbox"][id="greek"]')[0],
      swedish: $('input[type="checkbox"][id="swedish"]')[0],
      azerbaijani: $('input[type="checkbox"][id="azerbaijani"]')[0],
      bulgarian: $('input[type="checkbox"][id="bulgarian"]')[0],
      danish: $('input[type="checkbox"][id="danish"]')[0],
      estonian: $('input[type="checkbox"][id="estonian"]')[0],
      finnish: $('input[type="checkbox"][id="finnish"]')[0],
      hebrew: $('input[type="checkbox"][id="hebrew"]')[0],
      croatian: $('input[type="checkbox"][id="croatian"]')[0],
      hungarian: $('input[type="checkbox"][id="hungarian"]')[0],
      icelandic: $('input[type="checkbox"][id="icelandic"]')[0],
      latvian: $('input[type="checkbox"][id="latvian"]')[0],
      lithuanian: $('input[type="checkbox"][id="lithuanian"]')[0],
      dutch: $('input[type="checkbox"][id="dutch"]')[0],
      norwegian: $('input[type="checkbox"][id="norwegian"]')[0],
      portuguese: $('input[type="checkbox"][id="portuguese"]')[0],
      slovenian: $('input[type="checkbox"][id="slovenian"]')[0],
      slovak: $('input[type="checkbox"][id="slovak"]')[0],
      latin: $('input[type="checkbox"][id="latin"]')[0],
      ukrainian: $('input[type="checkbox"][id="ukrainian"]')[0],
      persian: $('input[type="checkbox"][id="persian"]')[0],
      arabic: $('input[type="checkbox"][id="arabic"]')[0],
      brazilian_port: $('input[type="checkbox"][id="brazilian_port"]')[0],
      czech: $('input[type="checkbox"][id="czech"]')[0],
      idonesian: $('input[type="checkbox"][id="idonesian"]')[0],
      serbian: $('input[type="checkbox"][id="serbian"]')[0]
    },

    pullMovieScore: true, translatedChineseNameInTitle: false,
    maxScreenshots: 10,
    sourceInfo: { default: '---', bluray: 'Blu-ray', web: 'WEB', hdtv: 'HDTV', dvd: 'DVD' },
    codecInfo: { default: '---', h264: 'H.264', h265: 'H.265', xvid: 'XviD', divx: 'DivX', x264: 'x264', x265: 'x265' },
    standardInfo: { default: '---', res1080i: '1080i', res1080p: '1080p', res2160p: '2160p', res720p: '720p', sd: '480p' },
    processingInfo: { default: '---', encode: 'Encode', remux: 'Remux' },
    containerInfo: { default: '---', mkv: 'MKV', mp4: 'MP4', avi: 'AVI' }
  }
}
//= ========================================================================================================
// functions
function escapeRegExp (string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function nestExplode (inputText, targetBoxTag) {
  let outputText, c
  const pat1 = '\\[' +
          targetBoxTag + '((?:=[^\\]]+)?\\](?:(?!\\[\\/' +
          targetBoxTag + '\\])[\\s\\S])*\\[' +
          targetBoxTag + '(?:=[^\\]]+)?\\])'
  const pat2 = '(\\[\\/' +
          targetBoxTag + '\\](?:(?!\\[' +
          targetBoxTag + '(?:=[^\\]]+)?\\])[\\s\\S])*)\\[\\/' +
          targetBoxTag + '\\]'
  const regex1 = RegExp(pat1, 'g')
  const regex2 = RegExp(pat2, 'g')
  do {
    outputText = inputText.replace(regex1, '[quote$1').replace(regex2, '$1[/quote]')
    c = (inputText !== outputText)
    inputText = outputText
  } while (c)
  return outputText
}
function compactContent (inputText, targetBoxTag) {
  let outputText, c
  const pat1 = '(\\[\\/?(?:' + targetBoxTag + ')(?:=[^\\]]+)?\\])\\s+(\\S)'
  const pat2 = '(\\S)\\s+(\\[\\/?(?:' + targetBoxTag + ')(?:=[^\\]]+)?\\])'
  const pat3 = '(\\[' + targetBoxTag + '(?:=[^\\]]+)?\\](?:(?!\\[\\/)[\\s\\S])*\\[(?:font|b|i|u|color|size)(?:=[^\\]]+)?\\])\\n+([^\\n])'
  const regex1 = RegExp(pat1, 'g')
  const regex2 = RegExp(pat2, 'g')
  const regex3 = RegExp(pat3, 'g')
  do {
    outputText = inputText.replace(regex1, '$1$2').replace(regex2, '$1$2').replace(regex3, '$1$2')
    c = (inputText !== outputText)
    inputText = outputText
  } while (c)
  return outputText
}
function formatTorrentName (torrentName) {
  return (
    torrentName
      .replace(/(\.torrent)+$/, '')
      .replace(/^\s?(\[.*?\]\s?)+/gi, '')
      .replace(/\s?(\(\d+\)\s?)+$/gi, '')
      .replace(/(\.(mkv|mp4|avi|ts|wmv|mpg|torrent))+$/, '')
      .replace(/\bh\.(26[45])\b/gi, 'H/$1')
      .replace(/(\b[a-zA-Z]*\d{1,2})\.(\d{1,2}\b)/g, function (_, p1, p2) {
        return p1 + '/' + p2
      })
      .replace(/\b\((\d{4})\)\b/g, '$1')
      .replace(/\bWEB(?!-DL)\b/gi, 'WEB-DL')
      .replace(/\bweb-?rip\b/gi, 'WEBRip')
      .replace(/\bblu-?ray\b/gi, 'BluRay')
      .replace(/\bdvd(rip)?\b/gi, function (_, p1) {
        return 'DVD' + (p1 ? 'Rip' : '')
      })
      .replace(/\b(480|720|1080|2160)([PI])\b/g, function (_, p1, p2) {
        return p1 + p2.toLowerCase()
      })
      .replace(/\bx\.?(26[45])\b/gi, 'x$1')
      .replace(/\./g, ' ')
      .replace(/\//g, '.')
      .trim()
  )
}
// decode [url=...][img]...[/img][/url] -> [comparison=...]...[/comparison]
function urlImg2Comparison (imagesWithUrl) {
  imagesWithUrl = imagesWithUrl.trim()
  const imageHost = imagesWithUrl.match(/pixhost/i)
    ? PIXHOST
    : imagesWithUrl.match(/imgbox/i)
      ? IMGBOX
      : imagesWithUrl.match(/img4k/i)
        ? IMG4K
        : imagesWithUrl.match(/pterclub/i)
          ? PTERCLUB
          : imagesWithUrl.match(/imgpile/i)
            ? IMGPILE
            : ''
  if (!imageHost) {
    return []
  }
  const regex = imageHost === PIXHOST
    ? /\[url=https:\/\/pixhost\.to\/show\/([A-Za-z0-9\-._~!$&'()*+,;=:@/?]+.png)\]\s*\[img\]https:\/\/t([A-Za-z0-9\-._~!$&'()*+,;=:@/?]+)\.pixhost[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+?\[\/img\]\s*\[\/url\]/gi
    : imageHost === IMGBOX
      ? /\[url=[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+\]\s*\[img\]https:\/\/thumbs([A-Za-z0-9\-._~!$&'()*+,;=:@/?]+)_t\.png\[\/img\]\s*\[\/url\]/gi
      : imageHost === IMG4K
        ? /\[url=[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+\]\s*\[img\]([A-Za-z0-9\-._~!$&'()*+,;=:@/?]+)\.md\.png\[\/img\]\s*\[\/url\]/gi
        : imageHost === PTERCLUB
          ? /\[url=[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+\]\s*\[img\]([A-Za-z0-9\-._~!$&'()*+,;=:@/?]+)\.th\.png\[\/img\]\s*\[\/url\]/gi
          : imageHost === IMGPILE
            ? /\[url=https:\/\/imgpile\.com\/i\/([A-Za-z0-9\-._~!$&'()*+,;=:@/?]+)\]\s*\[img\][A-Za-z0-9\-._~!$&'()*+,;=:@/?]+\.png\[\/img\]\s*\[\/url\]/gi
            : ''
  const replacement = imageHost === PIXHOST
    ? 'https://img$2.pixhost.to/images/$1 '
    : imageHost === IMGBOX
      ? 'https://images$1_o.png '
      : imageHost === IMG4K
        ? '$1.png '
        : imageHost === PTERCLUB
          ? '$1.png '
          : imageHost === IMGPILE
            ? 'https://imgpile.com/images/$1.png '
            : ''
  const matches = imagesWithUrl.match(regex)
  if (matches) {
    return imagesWithUrl
      .replace(regex, replacement)
      .split(/\s+/)
      .filter(ele => { return ele })
  } else {
    return []
  }
}
// [comparison=...]...[/comparison] -> decode [url=...][img]...[/img][/url]
async function comparison2UrlImg (imagesComparison, numTeams) {
  const imageHost = imagesComparison.match(/pixhost/i)
    ? PIXHOST
    : imagesComparison.match(/imgbox/i)
      ? IMGBOX
      : imagesComparison.match(/img4k/i)
        ? IMG4K
        : imagesComparison.match(/pterclub/i)
          ? PTERCLUB
          : imagesComparison.match(/imgpile/i)
            ? IMGPILE
            : imagesComparison.match(/ptpimg/i)
              ? PTPIMG
              : ''
  if (!imageHost) {
    return []
  }
  let regex = ''
  let replacement = ''
  if (imageHost === PIXHOST) {
    regex = /https:\/\/img(\d+)\.pixhost\.to\/images\/([\w/]+)\.png/gi
    replacement = '[url=https://pixhost.to/show/$2.png][img]https://t$1.pixhost.to/thumbs/$2.png[/img][/url]'
  } else if (imageHost === IMGBOX) {
    regex = /https:\/\/images(\d+)\.imgbox\.com\/(\w+\/\w+)\/(\w+)_o\.png/gi
    replacement = '[url=https://imgbox.com/$3][img]https://thumbs$1.imgbox.com/$2/$3_t.png[/img][/url]'
  }
  if (regex && replacement) {
    const matches = imagesComparison.match(regex)
    return matches
      ? matches.map(matched => {
        return matched.replace(regex, replacement)
      })
      : []
  } else {
    regex = /(https?:[A-Za-z0-9\-._~!$&'()*+,;=:@/?]+?\.(png|jpg))/gi
    const matches = imagesComparison.match(regex)
    const size = numTeams === 2
      ? 350
      : numTeams === 3
        ? 250
        : numTeams === 4
          ? 190
          : numTeams === 5
            ? 150
            : 150
    return matches
      ? await sendImagesToPixhost(matches, size)
      : []
  }
}
function decodeMediaInfo (mediainfoStr) {
  if (!mediainfoStr) {
    return {}
  }
  function matchField (text) {
    return text.match(/^\s*(.+?)\s+:\s*(.+)\s*$/)
  }
  function matchHead (text) {
    return text.match(/^\s*([\w]+(\s#\d+)?)$/)
  }
  let mi = {}
  mediainfoStr.split('\n\n').forEach(sector => {
    const miSector = {}
    let hasHead = false
    sector.split('\n').forEach(line => {
      const fieldArray = matchField(line)
      const headArray = matchHead(line)
      if (fieldArray) {
        miSector[fieldArray[1]] = fieldArray[2]
      } else if (headArray) {
        mi[headArray[1]] = miSector
        hasHead = true
      }
    })
    if (!hasHead) {
      mi = Object.assign({}, mi, miSector)
    }
  })
  return mi
}
async function sendImagesToPixhost (urls, size) {
  const hostname = 'https://pixhost.to/remote/'
  const data = encodeURI(`imgs=${urls.join('\r\n')}&content_type=0&max_th_size=${size}`)
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36'
  }
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef
    GM_xmlhttpRequest({
      method: 'POST',
      url: hostname,
      headers,
      data,
      onload: response => {
        if (response.status !== 200) {
          reject(response.status)
        } else {
          const data = response.responseText.match(/(upload_results = )({.*})(;)/)
          if (data && data.length) {
            const imgResultList = JSON.parse(data[2]).images
            resolve(imgResultList.map(item => {
              return `[url=${item.show_url}][img]${item.th_url}[/img][/url]`
            }))
          } else {
            console.log(response)
            reject(new Error('上传失败，请重试'))
          }
        }
      }
    })
  })
}
// 提取单个对比图信息
// eslint-disable-next-line no-unused-vars
function getOneComparison (text, index = 0, preferedRegex = '') {
  const regexArray = Object.keys(regexInfo)
  if (preferedRegex) {
    const currentPos = regexArray.findIndex(x => x === preferedRegex)
    if (currentPos > 0) {
      const temp = regexArray[0]
      regexArray[currentPos] = temp
      regexArray[0] = preferedRegex
    }
  }
  const result = { teams: [], urls: [], regexType: '', thumbs: false, slice: [0, 0] }
  for (const key of regexArray) {
    const regex = regexInfo[key].regex
    regex.lastIndex = index
    const match = regex.exec(text)
    if (match) {
      result.regexType = key
      if (regexInfo[key].groupForTeams >= 0) {
        result.teams = match[regexInfo[key].groupForTeams]
          .split(regexTeamsSplitter)
          .map(ele => { return ele.trim() })
      }
      if (regexInfo[key].groupForUrls >= 0) {
        const urls = match[regexInfo[key].groupForUrls]
        if (key === 'comparison') {
          result.urls = urls.match(regexImageUrlsSeparated)
        } else {
          result.urls = urls.match(regexScreenshotsThumbsSeparated)
        }
      }
      if (regexInfo[key].groupForThumbs >= 0) {
        result.thumbs = !!match[regexInfo[key].groupForThumbs]
      } else if (key === 'comparison') {
        result.thumbs = false
      } else if (key === 'simple') {
        result.thumbs = false
      }
      result.slice = [match.index, match.index + match[0].length]
      return result
    }
  }
  return result
}
// 提取全部对比图信息
function collectComparisons (text) {
  const replacements = []
  let lastIndex = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const currentIndex = lastIndex
    for (const key in regexInfo) {
      const regex = regexInfo[key].regex
      regex.lastIndex = lastIndex
      const match = regex.exec(text)
      if (match) {
        const result = { starts: 0, ends: 0, teams: [], urls: [], regexType: '', thumbs: false, text: '' }
        result.regexType = key
        if (regexInfo[key].groupForTeams >= 0) {
          result.teams = match[regexInfo[key].groupForTeams]
            .split(regexTeamsSplitter)
            .map(ele => { return ele.trim() })
        }
        if (regexInfo[key].groupForUrls >= 0) {
          const urls = match[regexInfo[key].groupForUrls]
          if (key === 'comparison') {
            result.urls = urls.match(regexImageUrlsSeparated)
          } else {
            result.urls = urls.match(regexScreenshotsThumbsSeparated)
          }
        }
        if (regexInfo[key].groupForThumbs >= 0) {
          result.thumbs = !!match[regexInfo[key].groupForThumbs]
        } else if (key === 'comparison') {
          result.thumbs = false
        } else if (key === 'simple') {
          result.thumbs = false
        }
        result.starts = match.index
        result.ends = match.index + match[0].length
        result.text = match[0]
        replacements.push(result)
        lastIndex = result.ends
        break
      }
    }
    if (lastIndex === currentIndex) {
      return replacements
    }
  }
}
// 对比图信息转换
async function generateComparison (siteName, textToConsume, torrentTitle, mediainfo, maxScreenshots) {
  const site = siteInfoMap[siteName]
  if (site.construct === NEXUSPHP) {
    let removePlainScreenshots = false
    const comparisons = collectComparisons(textToConsume)
      .sort((a, b) => b.starts - a.starts)
    for (let { starts, ends, teams, urls, regexType, thumbs } of comparisons) {
      let screenshotsStr = ''
      if (regexType === 'boxed' || regexType === 'titled' || regexType === 'comparison') {
        screenshotsStr = `[b]${teams.join(' | ')}[/b]`
        if (!thumbs) {
          urls = await comparison2UrlImg(urls.join(' '), teams.length)
        }
        urls.forEach((url, i) => {
          screenshotsStr += (i % teams.length === 0
            ? '\n' + url
            : ' ' + url)
        })
        screenshotsStr = `[center]${screenshotsStr}[/center]\n`
        removePlainScreenshots = true
      } else if (regexType === 'simple') {
        if (removePlainScreenshots) {
          screenshotsStr = ''
        } else {
          screenshotsStr = textToConsume.substring(starts, ends)
        }
      } else {
        screenshotsStr = ''
      }
      textToConsume = textToConsume.substring(0, starts) +
        screenshotsStr +
        textToConsume.substring(ends)
    }
    return textToConsume
  } else if (site.construct === GAZELLE && siteName === GPW) {
    let teamEncode = ''
    let description = ''
    let screenshots = ''
    let currentScreenshots = 0
    if (!torrentTitle && mediainfo && mediainfo.General) {
      let movieName = mediainfo.General['Complete name'] || mediainfo.General['Movie name']
      if (movieName) {
        movieName = formatTorrentName(movieName)
      }
    }
    const teamArray = torrentTitle.match(/\b(D-Z0N3)|(([^\s-@]*)(@[^\s-]+)?)$/)
    if (teamArray) {
      teamEncode = teamArray[0]
    }
    const comparisons = collectComparisons(textToConsume)
      .sort((a, b) => b.starts - a.starts)
    for (let { starts, ends, teams, urls, regexType, thumbs } of comparisons) {
      let screenshotsStr = ''
      if (regexType === 'comparison') {
        screenshotsStr = textToConsume.substring(starts, ends)
      } else if (regexType === 'boxed' || regexType === 'titled') {
        if (thumbs) {
          urls = urlImg2Comparison(urls.join(' '))
        }
        screenshotsStr = `[comparison=${teams.join(', ')}]${urls.join(' ')}[/comparison]`
      } else if (regexType === 'simple') {
        screenshotsStr = ''
      } else {
        screenshotsStr = ''
      }
      description += screenshotsStr
      if (urls.length > 0 && urls.length % teams.length === 0) {
        if (!screenshots && urls.length / teams.length >= 3) {
          for (let i = 0; i < urls.length; i++) {
            let image = urls[i]
            const teamCurrent = teams[i % teams.length]
            if (currentScreenshots < maxScreenshots && (teamCurrent === 'Encode' || teamCurrent.toLowerCase() === teamEncode.toLowerCase())) {
              screenshots += `[img]${image}[/img]`
              currentScreenshots += 1
            }
          }
        }
      }
      textToConsume = textToConsume.substring(0, starts) +
        screenshotsStr +
        textToConsume.substring(ends)
    }
    if (screenshots) {
      description += `[b]Screenshots[/b]\n${screenshots}`
    }
    const regexQuote = RegExp('\\[(quote|' + site.targetBoxTag + ')(=(.*?))?\\]([^]+)\\[\\/\\1\\]', 'gim')
    const matchQuote = textToConsume.match(regexQuote)
    let quotes = ''
    if (matchQuote) {
      matchQuote.forEach(quote => {
        quotes += quote.replace(/\[quote=(.*?)\]/gi, '[b]$1[/b][quote]')
      })
    }
    description = quotes + description
    return description
  }
}
function processDescription (siteName, description) {
  const construct = siteInfoMap[siteName].construct
  const targetTagBox = siteInfoMap[siteName].targetTagBox
  const boxSupportDescr = siteInfoMap[siteName].boxSupportDescr
  const otherTagBoxes = siteInfoMap[siteName].otherTagBoxes
  const unsupportedTags = siteInfoMap[siteName].unsupportedTags
  // 对于不支持box标签的站，统一替换为'quote'标签
  const replaceTag = targetTagBox || 'quote'
  if (targetTagBox) {
    description = nestExplode(description, targetTagBox)
    description = compactContent(description, targetTagBox)
  }
  if (construct === NEXUSPHP) {
    description = description
      // PuTao mediainfo style，切换为[box=mediainfo]的形式，以便于后续统一匹配mediainfo
      .replace(/\[quote=mediainfo\]([^]*?General\s*Unique\s*ID[^]*?)\[\/quote\]/gim,
        boxSupportDescr
          ? '[' + replaceTag + '=mediainfo]$1[/' + replaceTag + ']'
          : '[b]MediaInfo[/b]\n[' + replaceTag + ']$1[/' + replaceTag + ']')
      // NHD mediainfo style，切换为[box=mediainfo]的形式，以便于后续统一匹配mediainfo
      .replace(/\[mediainfo\]([^]*?General\s*Unique\s*ID[^]*?)\[\/mediainfo\]/gim,
        boxSupportDescr
          ? '[' + replaceTag + '=mediainfo]$1[/' + replaceTag + ']'
          : '[b]MediaInfo[/b]\n[' + replaceTag + ']$1[/' + replaceTag + ']')
      // mediainfo style for sites that do not support box tags，该条必须置于下一条上方，否则会被影响导致该类别mediainfo识别不到
      .replace(RegExp('(?:(?:\\[b\\])?mediainfo(?:\\[\\/b\\])?\\s*)?\\[(' + otherTagBoxes + ')\\]\\s*(General\\s+Unique\\s+ID[^]+?)\\[\\/\\1\\]', 'gi'),
        boxSupportDescr
          ? '[' + replaceTag + '=mediainfo]$2[/' + replaceTag + ']'
          : '[b]MediaInfo[/b]\n[' + replaceTag + ']$2[/' + replaceTag + ']')
      .replace(/(\[\/?)(\w+)((?:=(?:[^\r\n\t\f\v [\]])+)?\])/g, (_, p1, p2, p3) => {
        return p1 + p2.toLowerCase() + p3
      })
      // 注意otherTagBoxes不需要escape
      .replace(RegExp('\\[(?:' + otherTagBoxes + ')((=([^\\]]+))?)\\]', 'g'),
        boxSupportDescr
          ? `[${replaceTag}$1]`
          : `[b]$1[/b]\n[${replaceTag}]`)
      .replace(RegExp('\\[\\/(?:' + otherTagBoxes + ')\\]', 'g'), `[/${replaceTag}]`)
      .replace(/(?:(?:\[\/(url|flash|flv))|^)(?:(?!\[(url|flash|flv))[\s\S])*(?:(?:\[(url|flash|flv))|$)/g, matches => {
        return (matches.replace(/\[align(=\w*)?\]/g, '\n'))
      })
      .replace(RegExp('\\[\\/?(' + unsupportedTags + ')(=[^\\]]+)?\\]', 'g'), '')
      .replace(/\[pre\]/g, '[font=courier new]').replace(/\[\/pre\]/g, '[/font]')
      .replace(/^\s*([\s\S]*\S)\s*$/g, '$1')// 是否要加上第一行？/^(\s*\n)?([\s\S]*\S)\s*$/g
      .replace(/\[size=(\d+)\]/g, (match, p1) => {
        return parseInt(p1) > 7 ? '[size=7]' : match
      })
      .replace(/\[(\/?img)\d+\]/g, '[$1]') // for pterclub
  } else if (construct === GAZELLE) {
    if (siteName === GPW) {
      description = description
        .replace(/\[quote=mediainfo\]([^]*?General\s*Unique\s*ID[^]*?)\[\/quote\]/gim,
          '[' + replaceTag + '=mediainfo]$1[/' + replaceTag + ']')
        .replace(/\[mediainfo\]([^]*?General\s*Unique\s*ID[^]*?)\[\/mediainfo\]/gim,
          '[' + replaceTag + '=mediainfo]$1[/' + replaceTag + ']')
        .replace(RegExp('(?:(?:\\[b\\])?mediainfo(?:\\[\\/b\\])?\\s*)?\\[(' + otherTagBoxes + ')\\]\\s*(General\\s+Unique\\s+ID[^]+?)\\[\\/\\1\\]', 'gi'),
          '[' + replaceTag + '=mediainfo]$2[/' + replaceTag + ']')
        // 将box, mediainfo等tag都转换为quote的形式，后续（处理完对比图之后）会统一处理
        .replace(/(\[\/?)(\w+)((?:=(?:[^\r\n\t\f\v [\]])+)?\])/g, (_, p1, p2, p3) => {
          return p1 + p2.toLowerCase() + p3
        })
        .replace(RegExp('\\[(?:' + otherTagBoxes + ')((=([^\\]]+))?)\\]', 'g'), `[${replaceTag}$1]`)
        .replace(RegExp('\\[\\/(?:' + otherTagBoxes + ')\\]', 'g'), `[/${replaceTag}]`)
        .replace(/\[(size|color|font|b|i|pre)(=[^\]]+)?\]/g, '')
        .replace(/\[\/(size|color|font|b|i|pre)\]/g, '')
        .replace(/\[center\]/g, '\n')
        .replace(/\[\/center\]/g, '\n')
        .replace(/(?:(?:\[\/(url|flash|flv))|^)(?:(?!\[(url|flash|flv))[\s\S])*(?:(?:\[(url|flash|flv))|$)/g, matches => {
          return (matches.replace(/\[align(=\w*)?\]/g, '\n'))
        })
        .replace(RegExp('\\[\\/?(' + unsupportedTags + ')(=[^\\]]+)?\\]', 'g'), '')
        .replace(/^\s*([\s\S]*\S)\s*$/g, '$1')// 是否要加上第一行？/^(\s*\n)?([\s\S]*\S)\s*$/g
        .replace(/\[(\/?img)\d+\]/g, '[$1]') // for pterclub
    }
  }
  return description
}
(function () {
  'use strict'
  //= ========================================================================================================
  // Main
  const domainMatchArray = window.location.href.match(/(.*)\/(upload|edit|subtitles|dox)\.php/)
  if (!domainMatchArray) {
    return
  }
  const siteName = domainMatchArray[1].match(/nexushd/i)
    ? NHD
    : domainMatchArray[1].match(/pterclub/i)
      ? PTER
      : domainMatchArray[1].match(/pt\.sjtu/i)
        ? PUTAO
        : domainMatchArray[1].match(/m-team/i)
          ? MTEAM
          : domainMatchArray[1].match(/totheglory/i)
            ? TTG
            : domainMatchArray[1].match(/greatposterwall/i)
              ? GPW
              : domainMatchArray[1].match(/uhdbits/i)
                ? UHD
                : ''
  let page = domainMatchArray[2]
  if (siteName === TTG) {
    if (page === 'dox') {
      page = 'subitles'
    }
  }
  if (!siteName || !page) {
    return
  }
  const site = siteName ? siteInfoMap[siteName] : {}
  // 匿名发布开关
  const anonymous = true
  console.log(`running in site ${siteName} and page ${page}`)
  let nameBox = null
  if (page === 'upload' || page === 'edit') {
    //= ========================================================================================================
    // 上传和编辑种子页面
    nameBox = page === 'upload'
      ? site.nameBoxUpload
      : site.nameBoxEdit
    const btnBingo = $('<input>')
    if (site.construct === NEXUSPHP) {
      btnBingo.attr({
        type: 'button',
        name: 'bingo_converter',
        value: 'BINGO',
        style: 'font-size: 11px; font-weight: bold; color: blue; margin-right: 3px'
      })
      const table1 = $('<table>').attr({
        cellspacing: '1',
        cellpadding: '2',
        border: '0',
        style: 'margin-top:3px'
      }).append(
        $('<tbody>').append(
          $('<tr>').attr({ id: 'multi_function' }).append(
            $('<td>').attr({ class: 'embedded' }).append(btnBingo)
          )
        )
      )
      if (siteName === MTEAM || siteName === NHD || siteName === PTER || siteName === PUTAO) {
        $('#compose input[name="quote"]').closest('table').after(table1)
      } else if (siteName === TTG) {
        $('#upload input[name="quote"]').closest('table').after(table1)
      }
    } else if (site.construct === GAZELLE) {
      btnBingo.attr({
        type: 'button',
        name: 'bingo_converter',
        value: 'BINGO',
        style: 'font-weight: bold; color: white;',
        class: 'BBCodeToolbar-button'
      })
      const bbcodeToolbar = $('div.BBCodeToolbar').closest('#description-container').find('div.BBCodeToolbar')
      bbcodeToolbar.append(btnBingo)
    }
    // function definition
    btnBingo.on('click', async function () {
      const oriTextBingo = btnBingo.val()
      const torrentInfo = {}
      try {
        btnBingo.val('Handling')
        //= ========================================================================================================
        // processing description
        let textToConsume = ''
        if (site.construct === NEXUSPHP) {
          if (site.anonymousControl) {
            if (siteName === NHD || siteName === PTER || siteName === PUTAO || siteName === MTEAM) {
              site.anonymousControl.checked = anonymous
            } else if (siteName === TTG) {
              site.anonymousControl.val(anonymous ? 'yes' : 'no')
            }
          }
          const oldText = site.descrBox.val()
          let readClipboard = false
          if (siteName === NHD || siteName === PTER || siteName === PUTAO || siteName === MTEAM) {
            readClipboard = !oldText
          } else if (siteName === TTG) {
            readClipboard = !oldText ? true : oldText.length < 125
          }
          let descriptionAll = readClipboard ? await navigator.clipboard.readText() : oldText
          descriptionAll = processDescription(siteName, descriptionAll)
          site.descrBox.val(descriptionAll)
          textToConsume = descriptionAll
        } else if (site.construct === GAZELLE) {
          if (siteName === GPW) {
            const oldText = site.descrBox.val()
            let readClipboard = false
            readClipboard = !oldText
            let descriptionAll = readClipboard ? await navigator.clipboard.readText() : oldText
            descriptionAll = processDescription(siteName, descriptionAll)
            textToConsume = descriptionAll
          }
        }
        //= ========================================================================================================
        // info from title
        torrentInfo.torrentTitle = site.inputFile.val()
        if (torrentInfo.torrentTitle) {
          torrentInfo.editionInfo = {}
          torrentInfo.torrentTitle = /([^\\]+)$/.exec(torrentInfo.torrentTitle)[1]
          torrentInfo.torrentTitle = formatTorrentName(torrentInfo.torrentTitle)
          torrentInfo.editionInfo.criterionCollection = torrentInfo.torrentTitle.match(/\bcc|criterion\b/i)
          torrentInfo.editionInfo.directorCut = torrentInfo.torrentTitle.match(/\bdc\b/i)
          torrentInfo.editionInfo.unrated = torrentInfo.torrentTitle.match(/\bunrated\b/i)
          torrentInfo.editionInfo.uncut = torrentInfo.torrentTitle.match(/\buncut\b/i)
          torrentInfo.editionInfo.theatrical = torrentInfo.torrentTitle.match(/\btheatrical\b/i)
          torrentInfo.editionInfo.extended = torrentInfo.torrentTitle.match(/\bextended\b/i)
          // source
          torrentInfo.sourceInfo = {}
          torrentInfo.sourceInfo.remux = torrentInfo.torrentTitle.match(/\b(remux)\b/i)
          torrentInfo.sourceInfo.encode = torrentInfo.torrentTitle.match(/\b(blu-?ray|bdrip|dvdrip|webrip)\b/i)
          torrentInfo.sourceInfo.bluray = torrentInfo.torrentTitle.match(/\b(blu-?ray|bdrip)\b/i)
          torrentInfo.sourceInfo.hdtv = torrentInfo.torrentTitle.match(/\bhdtv\b/i)
          torrentInfo.sourceInfo.webdl = torrentInfo.torrentTitle.match(/\bweb-?dl\b/i)
          torrentInfo.sourceInfo.webrip = torrentInfo.torrentTitle.match(/\bwebrip\b/i)
          torrentInfo.sourceInfo.web = torrentInfo.sourceInfo.webdl || torrentInfo.sourceInfo.webrip
          torrentInfo.sourceInfo.dvd = torrentInfo.torrentTitle.match(/\bdvd(rip)?/i)
          torrentInfo.sourceInfo.hddvd = torrentInfo.torrentTitle.match(/\bhddvd\b/i)
          // resolution
          torrentInfo.standardInfo = {}
          torrentInfo.standardInfo.res1080p = torrentInfo.torrentTitle.match(/\b1080p\b/i)
          torrentInfo.standardInfo.res1080i = torrentInfo.torrentTitle.match(/\b1080i\b/i)
          torrentInfo.standardInfo.res720p = torrentInfo.torrentTitle.match(/\b720p\b/i)
          torrentInfo.standardInfo.res2160p = torrentInfo.torrentTitle.match(/\b2160p|4k\b/i)
          torrentInfo.standardInfo.sd = torrentInfo.torrentTitle.match(/\b480p\b/i) || torrentInfo.sourceInfo.dvd
          // processing
          torrentInfo.processingInfo = {}
          torrentInfo.processingInfo.raw = torrentInfo.torrentTitle.match(/\b(remux|web-?dl|(bd|dvd)?iso)\b/i)
          torrentInfo.processingInfo.encode = !torrentInfo.processingInfo.raw
          torrentInfo.processingInfo.remux = torrentInfo.torrentTitle.match(/\bremux\b/i)
          // codec
          torrentInfo.codecInfo = {}
          torrentInfo.codecInfo.h264 = torrentInfo.torrentTitle.match(/\bh\.?264\b/i)
          torrentInfo.codecInfo.x264 = torrentInfo.torrentTitle.match(/\bavc|x264\b/i)
          torrentInfo.codecInfo.h265 = torrentInfo.torrentTitle.match(/\bh\.?265\b/i)
          torrentInfo.codecInfo.x265 = torrentInfo.torrentTitle.match(/\bhevc|x265\b/i)
          torrentInfo.codecInfo.vc1 = torrentInfo.torrentTitle.match(/\bvc-1\b/i)
          torrentInfo.codecInfo.mpeg2 = torrentInfo.torrentTitle.match(/\bmpeg-2\b/i)
          torrentInfo.codecInfo.xvid = torrentInfo.torrentTitle.match(/\bxvid\b/i)
          torrentInfo.codecInfo.divx = torrentInfo.torrentTitle.match(/\bdivx\b/i)
          torrentInfo.codecInfo.flac = torrentInfo.torrentTitle.match(/\bflac\b/i)
          torrentInfo.codecInfo.ape = torrentInfo.torrentTitle.match(/\bape\b/i)
          // team
          const teamArray = torrentInfo.torrentTitle.match(/\b(D-Z0N3)|(([^\s-@]*)(@[^\s-]+)?)$/)
          torrentInfo.team = teamArray ? teamArray[0] : ''
        }
        //= ========================================================================================================
        // info from mediainfo
        torrentInfo.audioInfo = {
          chineseDub: false, cantoneseDub: false, commentary: false
        }
        torrentInfo.videoInfo = {
          bit10: false, hdr10: false, hdr10plus: false, dovi: false, container: ''
        }
        const subtitleLanguages = ['chinese_simplified', 'chinese_traditional', 'japanese', 'korean', 'english', 'french',
          'german', 'italian', 'polish', 'romanian', 'russian', 'spanish', 'thai', 'turkish', 'vietnamese', 'hindi',
          'greek', 'swedish', 'azerbaijani', 'bulgarian', 'danish', 'estonian', 'finnish', 'hebrew', 'croatian', 'hungarian',
          'icelandic', 'latvian', 'lithuanian', 'dutch', 'norwegian', 'portuguese', 'slovenian', 'slovak', 'latin',
          'ukrainian', 'persian', 'arabic', 'brazilian_port', 'czech', 'idonesian', 'serbian'
        ]
        torrentInfo.subtitleInfo = {}
        subtitleLanguages.forEach(lang => {
          torrentInfo.subtitleInfo[lang] = false
        })
        torrentInfo.mediainfo = {}
        torrentInfo.mediainfoStr = ''
        if (site.decodingMediainfo) {
          // 优先从简介中获取mediainfo
          const tagForMediainfo = site.targetTagBox || 'quote'
          const regexMIStr = site.boxSupportDescr
            ? '\\[' + tagForMediainfo + '\\s*=\\s*mediainfo\\][^]*?(General\\s*Unique\\s*ID[^\\0]*?)\\[\\/' + tagForMediainfo + '\\]'
            : '\\[' + tagForMediainfo + '\\][^]*?(General\\s*Unique\\s*ID[^\\0]*?)\\[\\/' + tagForMediainfo + '\\]'
          const regexMI = RegExp(regexMIStr, 'im')
          const mediainfoArray = textToConsume.match(regexMI)
          if (mediainfoArray) {
            torrentInfo.mediainfoStr = mediainfoArray[1]
              .replace(/^\s*\[\w+(\s*=[^\]]+)?\]/g, '')
              .replace(/\s*\[\/\w+\]\s*$/g, '')
            torrentInfo.mediainfo = decodeMediaInfo(torrentInfo.mediainfoStr)
          }
          if (Object.keys(torrentInfo.mediainfo).length === 0 && site.mediainfoBox) {
            // 如果简介中没有有效的mediainfo，读取mediainfobox
            torrentInfo.mediainfoStr = site.mediainfoBox.val()
            torrentInfo.mediainfo = decodeMediaInfo(torrentInfo.mediainfoStr)
          }
          Object.entries(torrentInfo.mediainfo).forEach(([infoKey, infoValue]) => {
            if (infoKey.match(/text( #\d+)?/i)) {
              // subtitle
              let matchLang = false
              const language = infoValue.Language || infoValue.Title
              if (language.match(/chinese|chs|cht/i)) {
                if (language.match(/cht|(chinese( |_)traditional)/i)) {
                  torrentInfo.subtitleInfo.chinese_traditional = true
                } else {
                  torrentInfo.subtitleInfo.chinese_simplified = true
                }
                matchLang = true
              } else {
                Object.keys(torrentInfo.subtitleInfo).forEach(lang => {
                  if (language.match(RegExp(escapeRegExp(lang), 'i')) || language.match(RegExp(escapeRegExp(lang.replace(/_/ig, ' ')), 'i'))) {
                    torrentInfo.subtitleInfo[lang] = true
                    matchLang = true
                  }
                })
              }
              if (matchLang) {
                console.log(`Match sub ${language}`)
              } else {
                console.log(`Other sub ${language}`)
              }
            } else if (infoKey.match(/audio( #\d+)?/i)) {
              // audio
              const title = infoValue.Title || ''
              const language = infoValue.Language || ''
              if (title.match(/commentary/i)) {
                torrentInfo.audioInfo.commentary = true
              }
              if (title.match(/cantonese/i) || language.match(/cantonese/i)) {
                torrentInfo.audioInfo.cantoneseDub = true
                console.log('Cantonese dub')
              } else if (title.match(/chinese|mandarin/i) || language.match(/chinese|mandarin/i)) {
                torrentInfo.audioInfo.chineseDub = true
                console.log('Chinese Mandarin dub')
              } else {
                console.log('Other dub')
              }
            } else if (infoKey.match(/video/i)) {
              // video
              const hdrFormat = infoValue['HDR format']
              const bitDepth = infoValue['Bit depth']
              if (hdrFormat) {
                if (hdrFormat.match(/HDR10\+/i)) {
                  torrentInfo.videoInfo.hdr10plus = true
                  console.log('HDR10+')
                } else if (hdrFormat.match(/HDR10/i)) {
                  torrentInfo.videoInfo.hdr10 = true
                  console.log('HDR10')
                }
                if (hdrFormat.match(/Dolby Vision/i)) {
                  torrentInfo.videoInfo.dovi = true
                  console.log('Dolby Vision')
                }
              } else if (bitDepth.match(/10 bits/i)) {
                torrentInfo.videoInfo.bit10 = true
                console.log('10 bits')
              }
            } else if (infoKey.match(/general/i)) {
              // general
              if (infoValue.Format === 'Matroska') {
                torrentInfo.videoInfo.container = 'MKV'
              } else if (infoValue.Format === 'MPEG-4') {
                torrentInfo.videoInfo.container = 'MP4'
              } else if (infoValue.Format === 'AVI') {
                torrentInfo.videoInfo.container = 'AVI'
              } else {
                torrentInfo.videoInfo.container = infoValue.Format.trim()
              }
              console.log(torrentInfo.videoInfo.container)
            }
          })
        }
        //= ========================================================================================================
        // info from douban / imdb
        const categoryMovie = 'Movie'; const categoryTvSeries = 'TV Series'; const categoryAnimation = 'Animation'
        const categoryDocumentary = 'Documentary'; const categoryTvShow = 'TV Show'
        if (site.construct === NEXUSPHP) {
          torrentInfo.movieInfo = { areaInfo: {} }
          // area
          const areaArray = textToConsume.match(/产\s*地\s*(.*)\s*/)
          const area = areaArray ? areaArray[1] : ''
          if (area.match(/中国大陆/)) {
            torrentInfo.movieInfo.areaInfo.cnMl = true
          } else if (area.match(/香港/)) {
            torrentInfo.movieInfo.areaInfo.hk = true
          } else if (area.match(/台湾/)) {
            torrentInfo.movieInfo.areaInfo.tw = true
          } else if (area.match(/美国|加拿大|英国|法国|德国|希腊|匈牙利|爱尔兰|意大利|阿尔巴尼亚|安道尔|奥地利|白俄罗斯|比利时|波斯尼亚|黑塞哥维那|保加利亚|克罗地亚|塞浦路斯|捷克|丹麦|爱沙尼亚|法罗群岛|冰岛|芬兰|拉脱维亚|列支敦士登|立陶宛|卢森堡|马其顿|马耳他|摩尔多瓦|摩纳哥|荷兰|挪威|波兰|葡萄牙|罗马尼亚|俄罗斯|圣马力诺|塞黑|斯洛伐克|斯洛文尼亚|西班牙|瑞典|瑞士|乌克兰|梵蒂冈/)) {
            torrentInfo.movieInfo.areaInfo.euAme = true
          } else if (area.match(/印度|韩国|日本|新加坡|泰国|印度尼西亚|菲律宾|越南|土耳其|老挝|柬埔寨|缅甸|马来西亚|文莱|东帝汶|尼泊尔|不丹|孟加拉国|巴基斯坦|斯里兰卡|马尔代夫|阿富汗|伊拉克|伊朗|叙利亚|约旦|黎巴嫩|以色列|巴勒斯坦|沙特阿拉伯|阿曼|也门|格鲁吉亚|亚美尼亚|塞浦路斯|哈萨克斯坦|吉尔吉斯斯坦|塔吉克斯坦|乌兹别克斯坦|土库曼斯坦|蒙古|朝鲜/)) {
            torrentInfo.movieInfo.areaInfo.asia = true
            if (area.match(area.match(/韩国/))) {
              torrentInfo.movieInfo.areaInfo.kor = true
            } else if (area.match(/日本/)) {
              torrentInfo.movieInfo.areaInfo.jap = true
            } else if (area.match(/印度/)) {
              torrentInfo.movieInfo.areaInfo.ind = true
            }
          }
          // title
          const translatedTitleArray = textToConsume.match(/译\s*名\s*([^/\n]+)(?:\/|\n)/)
          const originalTitleArray = textToConsume.match(/片\s*名\s*([^/\n]+)(?:\/|\n)/)
          if (translatedTitleArray && originalTitleArray) {
            torrentInfo.movieInfo.translatedTitle = translatedTitleArray[1].trim()
            torrentInfo.movieInfo.originalTitle = originalTitleArray[1].trim()
          }
          // festival
          const festivalArray = textToConsume.match(/(\d{4})-\d{2}-\d{2}\((\S+电影节)\)/)
          torrentInfo.movieInfo.festival = festivalArray ? (festivalArray[1] + festivalArray[2]).trim() : ''
          // category
          const genresArray = textToConsume.match(/类\s*别\s+([^\n]*)\s*\n/)
          torrentInfo.movieInfo.genres = genresArray
            ? genresArray[1].replace(/([^ ])\/([^ ])/g, '$1 / $2')
            : ''
          torrentInfo.movieInfo.category = torrentInfo.movieInfo.genres.match('纪录')
            ? categoryDocumentary
            : torrentInfo.movieInfo.genres.match('动画')
              ? categoryAnimation
              : textToConsume.match(/集\s*数\s+/g)
                ? categoryTvSeries
                : torrentInfo.movieInfo.genres.match('秀')
                  ? categoryTvShow
                  : categoryMovie
          // douban and imdb score in small_desc
          const doubanScoreArray = textToConsume.match(/豆\s*瓣\s*评\s*分\s+(\d\.\d)\/10\sfrom\s((?:\d+,)*\d+)\susers/)
          if (doubanScoreArray) {
            torrentInfo.movieInfo.doubanScore = doubanScoreArray[1]
            torrentInfo.movieInfo.doubanScoreRatingNumber = doubanScoreArray[2]
          }
          const imdbScoreArray = textToConsume.match(/IMDb\s*评\s*分\s+(\d\.\d)\/10\sfrom\s((?:\d+,)*\d+)\susers/i)
          if (imdbScoreArray) {
            torrentInfo.movieInfo.imdbScore = imdbScoreArray[1]
            torrentInfo.movieInfo.imdbRatingNumber = imdbScoreArray[2]
          }
          // director
          const directorArray = textToConsume.match(/导\s*演\s+([^\w\n\s]*)\s*/)
          torrentInfo.movieInfo.director = directorArray ? directorArray[1] : ''
          // douban link
          const doubanLinkArray = textToConsume.match(/豆瓣\s*链\s*接.+(https?:\/\/movie\.douban\.com\/subject\/(\d+)\/?)/)
          torrentInfo.movieInfo.doubanLink = doubanLinkArray ? doubanLinkArray[1] : ''
          torrentInfo.movieInfo.doubanId = doubanLinkArray ? doubanLinkArray[2] : ''
          // imdb link
          const imdbLinkArray = textToConsume.match(/IMDb\s*链\s*接.+(https?:\/\/www\.imdb\.com\/title\/(tt\d+)\/?)/i)
          torrentInfo.movieInfo.imdbLink = imdbLinkArray ? imdbLinkArray[1] : ''
          torrentInfo.movieInfo.imdbId = imdbLinkArray ? imdbLinkArray[2] : ''
        }
        //= ========================================================================================================
        // fill the page
        // common controls
        // 用于记录种子在站点的匹配信息
        torrentInfo.infoInSite = { site: siteName }
        // namebox
        if (nameBox && torrentInfo.torrentTitle) {
          torrentInfo.infoInSite.torrentTitle = torrentInfo.torrentTitle
          if (site.translatedChineseNameInTitle) {
            if (torrentInfo.movieInfo.areaInfo.cnMl) {
              torrentInfo.infoInSite.torrentTitle = torrentInfo.torrentTitle.match(torrentInfo.movieInfo.originalTitle)
                ? torrentInfo.torrentTitle
                : `[${torrentInfo.movieInfo.originalTitle}] ${torrentInfo.torrentTitle}`
            } else {
              torrentInfo.infoInSite.torrentTitle = torrentInfo.torrentTitle.match(torrentInfo.movieInfo.translatedTitle)
                ? torrentInfo.torrentTitle
                : `[${torrentInfo.movieInfo.translatedTitle}] ${torrentInfo.torrentTitle}`
            }
          } else {
            torrentInfo.infoInSite.torrentTitle = torrentInfo.torrentTitle
          }
          nameBox.val(torrentInfo.infoInSite.torrentTitle)
        }
        // small description
        if (site.smallDescBox && torrentInfo.movieInfo && (torrentInfo.movieInfo.doubanLink || torrentInfo.movieInfo.imdbLink)) {
          // container for small_desc(副标题) fields
          const smallDescrArray = []
          if (torrentInfo.movieInfo.originalTitle && torrentInfo.movieInfo.translatedTitle) {
            if (!site.translatedChineseNameInTitle) {
              if (torrentInfo.movieInfo.areaInfo.cnMl) {
                smallDescrArray.push(torrentInfo.torrentTitle.match(torrentInfo.movieInfo.originalTitle)
                  ? torrentInfo.movieInfo.translatedTitle
                  : torrentInfo.movieInfo.originalTitle)
              } else {
                smallDescrArray.push(torrentInfo.movieInfo.translatedTitle)
              }
            }
          }
          if (torrentInfo.movieInfo.festival) {
            smallDescrArray.push(torrentInfo.movieInfo.festival)
          }
          if (torrentInfo.movieInfo.genres) {
            smallDescrArray.push(torrentInfo.movieInfo.genres)
          }
          if (!site.pullMovieScore) {
            if (torrentInfo.movieInfo.doubanScore) {
              smallDescrArray.push('豆瓣 ' + torrentInfo.movieInfo.doubanScore + '（' + torrentInfo.movieInfo.doubanScoreRatingNumber + '）')
            }
            if (torrentInfo.movieInfo.imdbScore) {
              smallDescrArray.push('IMDb ' + torrentInfo.movieInfo.imdbScore + '（' + torrentInfo.movieInfo.imdbRatingNumber + '）')
            }
          }
          if (torrentInfo.movieInfo.director) {
            smallDescrArray.push(torrentInfo.movieInfo.director)
          }
          // complete small_descr
          torrentInfo.infoInSite.smallDescr = smallDescrArray.join(' | ')
          site.smallDescBox.val(torrentInfo.infoInSite.smallDescr)
        }
        // douban link
        if (site.doubanLinkBox && torrentInfo.movieInfo && torrentInfo.movieInfo.doubanLink) {
          if (!site.doubanIdInsteadofLink) {
            site.doubanLinkBox.val(torrentInfo.movieInfo.doubanLink)
          } else {
            site.doubanLinkBox.val(torrentInfo.movieInfo.doubanId)
          }
        }
        // imdb link
        if (site.imdbLinkBox && torrentInfo.movieInfo && torrentInfo.movieInfo.imdbLink) {
          if (!site.doubanIdInsteadofLink) {
            site.imdbLinkBox.val(torrentInfo.movieInfo.imdbLink)
          } else {
            site.imdbLinkBox.val(torrentInfo.movieInfo.imdbId)
          }
        }
        // source
        if (site.sourceSel && torrentInfo.sourceInfo) {
          torrentInfo.infoInSite.source = site.sourceInfo.default || 0
          if (siteName === PTER) {
            torrentInfo.infoInSite.source = torrentInfo.sourceInfo.remux
              ? site.sourceInfo.remux// remux
              : torrentInfo.sourceInfo.encode
                ? site.sourceInfo.encode// encode
                : torrentInfo.sourceInfo.hdtv
                  ? site.sourceInfo.hdtv// hdtv
                  : torrentInfo.sourceInfo.webdl
                    ? site.sourceInfo.webdl// web-dl
                    : torrentInfo.sourceInfo.dvd || torrentInfo.sourceInfo.hddvd
                      ? site.sourceInfo.dvd
                      : torrentInfo.infoInSite.source// other
          } else if (siteName === NHD) {
            torrentInfo.infoInSite.source = torrentInfo.sourceInfo.bluray
              ? site.sourceInfo.bluray
              : torrentInfo.sourceInfo.hddvd
                ? site.sourceInfo.hddvd
                : torrentInfo.sourceInfo.dvd
                  ? site.sourceInfo.dvd
                  : torrentInfo.sourceInfo.webdl
                    ? site.sourceInfo.webdl
                    : torrentInfo.sourceInfo.webrip
                      ? site.sourceInfo.webrip
                      : torrentInfo.infoInSite.source
          } else if (siteName === GPW) {
            torrentInfo.infoInSite.source = torrentInfo.sourceInfo.bluray
              ? site.sourceInfo.bluray
              : torrentInfo.sourceInfo.hddvd
                ? site.sourceInfo.hddvd
                : torrentInfo.sourceInfo.dvd
                  ? site.sourceInfo.dvd
                  : torrentInfo.sourceInfo.web
                    ? site.sourceInfo.web
                    : torrentInfo.infoInSite.source
          }
          site.sourceSel.val(torrentInfo.infoInSite.source)
        }
        // standard
        if (site.standardSel && torrentInfo.standardInfo) {
          torrentInfo.infoInSite.standard = torrentInfo.standardInfo.res1080p
            ? site.standardInfo.res1080p
            : torrentInfo.standardInfo.res1080i
              ? site.standardInfo.res1080i
              : torrentInfo.standardInfo.res720p
                ? site.standardInfo.res720p
                : torrentInfo.standardInfo.res2160p
                  ? site.standardInfo.res2160p
                  : torrentInfo.standardInfo.sd
                    ? site.standardInfo.sd
                    : site.standardInfo.default
          site.standardSel.val(torrentInfo.infoInSite.standard)
        }
        // processing
        if (site.processingSel && torrentInfo.processingInfo) {
          torrentInfo.infoInSite.processing = site.processingInfo.default || 0
          if (siteName === NHD) {
            torrentInfo.infoInSite.processing = torrentInfo.processingInfo.raw
              ? site.processingInfo.raw
              : torrentInfo.processingInfo.encode
                ? site.processingInfo.encode
                : torrentInfo.infoInSite.processing
          } else if (siteName === GPW) {
            site.processingSel.closest('tr.hidden').removeClass('hidden')
            torrentInfo.infoInSite.processing = torrentInfo.processingInfo.remux
              ? site.processingInfo.remux
              : torrentInfo.processingInfo.encode
                ? site.processingInfo.encode
                : torrentInfo.infoInSite.processing
          }
          site.processingSel.val(torrentInfo.infoInSite.processing)
        }
        // codec
        if (site.codecSel && torrentInfo.codecInfo) {
          torrentInfo.infoInSite.codec = site.codecInfo.default || 0
          if (siteName === NHD || siteName === PUTAO || siteName === MTEAM) {
            torrentInfo.infoInSite.codec = torrentInfo.codecInfo.x264 || torrentInfo.codecInfo.h264
              ? site.codecInfo.h264
              : torrentInfo.codecInfo.x265 || torrentInfo.codecInfo.h265
                ? site.codecInfo.h265
                : torrentInfo.codecInfo.vc1
                  ? site.codecInfo.vc1
                  : torrentInfo.codecInfo.mpeg2
                    ? site.codecInfo.mpeg2
                    : torrentInfo.codecInfo.xvid
                      ? site.codecInfo.xvid
                      : torrentInfo.codecInfo.flac
                        ? site.codecInfo.flac
                        : torrentInfo.codecInfo.ape
                          ? site.codecInfo.ape
                          : torrentInfo.infoInSite.codec
          } else if (siteName === GPW) {
            torrentInfo.infoInSite.codec = torrentInfo.codecInfo.h264
              ? site.codecInfo.h264
              : torrentInfo.codecInfo.h265
                ? site.codecInfo.h265
                : torrentInfo.codecInfo.x264
                  ? site.codecInfo.x264
                  : torrentInfo.codecInfo.x265
                    ? site.codecInfo.x265
                    : torrentInfo.codecInfo.xvid
                      ? site.codecInfo.xvid
                      : torrentInfo.codecInfo.divx
                        ? site.codecInfo.divx
                        : torrentInfo.infoInSite.codec
          }
          site.codecSel.val(torrentInfo.infoInSite.codec)
        }
        // team
        if (site.teamSel) {
          if (siteName === MTEAM) {
            site.teamSel.find('option').each((_, element) => {
              if (element.text.toLowerCase() === torrentInfo.team.toLowerCase()) {
                torrentInfo.infoInSite.team = element.value
                site.teamSel.val(torrentInfo.infoInSite.team)
              }
            })
          }
        }
        // area selection
        if (site.areaSel && torrentInfo.movieInfo && torrentInfo.movieInfo.areaInfo) {
          torrentInfo.infoInSite.area = site.areaInfo.default || 0
          if (siteName === PTER) {
            torrentInfo.infoInSite.area = torrentInfo.movieInfo.areaInfo.cnMl
              ? site.areaInfo.cnMl
              : torrentInfo.movieInfo.areaInfo.hk
                ? site.areaInfo.hk
                : torrentInfo.movieInfo.areaInfo.tw
                  ? site.areaInfo.tw
                  : torrentInfo.movieInfo.areaInfo.euAme
                    ? site.areaInfo.euAme
                    : torrentInfo.movieInfo.areaInfo.kor
                      ? site.areaInfo.kor
                      : torrentInfo.movieInfo.areaInfo.jap
                        ? site.areaInfo.jap
                        : torrentInfo.movieInfo.areaInfo.ind
                          ? site.areaInfo.ind
                          : site.areaInfo.other
          } else if (siteName === MTEAM) {
            torrentInfo.infoInSite.area = torrentInfo.movieInfo.areaInfo.cnMl
              ? site.areaInfo.cnMl
              : torrentInfo.movieInfo.areaInfo.euAme
                ? site.areaInfo.euAme
                : torrentInfo.movieInfo.areaInfo.hk || torrentInfo.movieInfo.areaInfo.tw
                  ? site.areaInfo.hkTw
                  : torrentInfo.movieInfo.areaInfo.jap
                    ? site.areaInfo.jap
                    : torrentInfo.movieInfo.areaInfo.kor
                      ? site.areaInfo.kor
                      : site.areaInfo.other
          }
          site.areaSel.val(torrentInfo.infoInSite.area)
        }
        // category selection
        if (site.categorySel) {
          torrentInfo.infoInSite.category = site.categoryInfo.default || 0
          if ((siteName === NHD || siteName === PTER) && torrentInfo.movieInfo) {
            torrentInfo.infoInSite.category = torrentInfo.movieInfo.category === categoryMovie
              ? site.categoryInfo.movie
              : torrentInfo.movieInfo.category === categoryTvSeries
                ? site.categoryInfo.tvSeries
                : torrentInfo.movieInfo.category === categoryAnimation
                  ? site.categoryInfo.animation
                  : torrentInfo.movieInfo.category === categoryDocumentary
                    ? site.categoryInfo.documentary
                    : torrentInfo.movieInfo.category === categoryTvShow
                      ? site.categoryInfo.tvShow
                      : torrentInfo.infoInSite.category
          } else if (siteName === PUTAO && torrentInfo.movieInfo && torrentInfo.movieInfo.areaInfo) {
            if (torrentInfo.movieInfo.category === categoryMovie) {
              torrentInfo.infoInSite.category = torrentInfo.movieInfo.areaInfo.cnMl ||
                torrentInfo.movieInfo.areaInfo.hk || torrentInfo.movieInfo.areaInfo.tw
                ? site.categoryInfo.movieCn
                : torrentInfo.movieInfo.areaInfo.euAme
                  ? site.categoryInfo.movieEuAme
                  : torrentInfo.movieInfo.areaInfo.asia
                    ? site.categoryInfo.movieAsia
                    : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryDocumentary) {
              // for clarification
              torrentInfo.infoInSite.category = site.categoryInfo.documentary
            } else if (torrentInfo.movieInfo.category === categoryAnimation) {
              // for clarification
              torrentInfo.infoInSite.category = site.categoryInfo.animation
            } else if (torrentInfo.movieInfo.category === categoryTvSeries) {
              torrentInfo.infoInSite.category = torrentInfo.movieInfo.areaInfo.hk || torrentInfo.movieInfo.areaInfo.tw
                ? site.categoryInfo.tvSeriesHkTw
                : torrentInfo.movieInfo.areaInfo.cnMl
                  ? site.categoryInfo.tvSeriesCnMl
                  : torrentInfo.movieInfo.areaInfo.asia
                    ? site.categoryInfo.tvSeriesAsia
                    : torrentInfo.movieInfo.areaInfo.euAme
                      ? site.categoryInfo.tvSeriesEuAme
                      : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryTvShow) {
              torrentInfo.infoInSite.category = torrentInfo.movieInfo.areaInfo.cnMl
                ? site.categoryInfo.tvShowCnMl
                : torrentInfo.movieInfo.areaInfo.hk || torrentInfo.movieInfo.areaInfo.tw
                  ? site.categoryInfo.tvShowHkTw
                  : torrentInfo.movieInfo.areaInfo.euAme
                    ? site.categoryInfo.tvShowEuAme
                    : torrentInfo.movieInfo.areaInfo.jap || torrentInfo.movieInfo.areaInfo.kor
                      ? site.categoryInfo.tvShowJapKor
                      : torrentInfo.infoInSite.category
            }
          } else if (siteName === MTEAM && torrentInfo.sourceInfo) {
            if (torrentInfo.movieInfo.category === categoryMovie) {
              torrentInfo.infoInSite.category = torrentInfo.sourceRemux
                ? site.categoryInfo.movieRemux
                : torrentInfo.sourceInfo.encode || torrentInfo.sourceInfo.hdtv || torrentInfo.sourceInfo.hddvd || torrentInfo.sourceInfo.web
                  ? site.categoryInfo.movieHd
                  : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryTvSeries || torrentInfo.movieInfo.category === categoryTvShow) {
              torrentInfo.infoInSite.category = torrentInfo.sourceInfo.encode || torrentInfo.sourceInfo.hdtv || torrentInfo.sourceInfo.hddvd || torrentInfo.sourceInfo.web
                ? site.categoryInfo.tvSeriesHd
                : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryDocumentary) {
              torrentInfo.infoInSite.category = site.categoryInfo.documentary
            } else if (torrentInfo.movieInfo.category === categoryAnimation) {
              torrentInfo.infoInSite.category = site.categoryInfo.animation
            }
          } else if (siteName === TTG && torrentInfo.standardInfo && torrentInfo.movieInfo && torrentInfo.movieInfo.areaInfo) {
            if (torrentInfo.movieInfo.category === categoryMovie) {
              torrentInfo.infoInSite.category = torrentInfo.standardInfo.res720p
                ? site.categoryInfo.movie720p
                : torrentInfo.standardInfo.res1080i || torrentInfo.standardInfo.res1080p
                  ? site.categoryInfo.movie1080ip
                  : torrentInfo.standardInfo.res2160p
                    ? site.categoryInfo.movie2160p
                    : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryDocumentary) {
              torrentInfo.infoInSite.category = torrentInfo.standardInfo.res720p
                ? site.categoryInfo.documentary720p
                : torrentInfo.standardInfo.res1080i || torrentInfo.standardInfo.res1080p
                  ? site.categoryInfo.documentary1080ip
                  : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryAnimation) {
              torrentInfo.infoInSite.category = site.categoryInfo.animation
            } else if (torrentInfo.movieInfo.category === categoryTvSeries) {
              torrentInfo.infoInSite.category = torrentInfo.movieInfo.areaInfo.jap
                ? site.categoryInfo.tvSeriesJap
                : torrentInfo.movieInfo.areaInfo.kor
                  ? site.categoryInfo.tvSeriesKor
                  : torrentInfo.euAme
                    ? site.categoryInfo.tvSeriesEuAme
                    : torrentInfo.movieInfo.areaInfo.cnMl || torrentInfo.movieInfo.areaInfo.hk || torrentInfo.movieInfo.areaInfo.tw
                      ? site.categoryInfo.tvSeriesCn
                      : torrentInfo.infoInSite.category
            } else if (torrentInfo.movieInfo.category === categoryTvShow) {
              torrentInfo.infoInSite.category = torrentInfo.movieInfo.areaInfo.kor
                ? site.categoryInfo.tvShowKor
                : torrentInfo.movieInfo.areaInfo.jap
                  ? site.categoryInfo.tvShowJap
                  : site.categoryInfo.tvShow
            }
          }
          site.categorySel.val(torrentInfo.infoInSite.category)
        }
        // site-specific
        if (siteName === PTER && torrentInfo.subtitleInfo && torrentInfo.audioInfo) {
          if (site.chsubCheck && site.englishSubCheck && site.chdubCheck && site.cantodubCheck) {
            site.chsubCheck.checked = torrentInfo.subtitleInfo.chinese_simplified || torrentInfo.subtitleInfo.chinese_traditional
            site.englishSubCheck.checked = torrentInfo.subtitleInfo.english
            site.chdubCheck.checked = torrentInfo.audioInfo.chineseDub
            site.cantodubCheck.checked = torrentInfo.audioInfo.cantoneseDub
          }
        } else if (siteName === MTEAM && torrentInfo.subtitleInfo && torrentInfo.audioInfo) {
          if (site.chsubCheck && site.chdubCheck) {
            site.chsubCheck.checked = torrentInfo.subtitleInfo.chinese_simplified || torrentInfo.subtitleInfo.chinese_traditional
            site.chdubCheck.checked = torrentInfo.audioInfo.chineseDub
          }
        } else if (siteName === TTG && torrentInfo.subtitleInfo) {
          if (torrentInfo.subtitleInfo.chinese_simplified && torrentInfo.subtitleInfo.chinese_traditional) {
            site.subtitleBox.val('* 内封简繁字幕')
          } else if (torrentInfo.subtitleInfo.chinese_simplified) {
            site.subtitleBox.val('* 内封简体字幕')
          } else if (torrentInfo.subtitleInfo.chinese_traditional) {
            site.subtitleBox.val('* 内封繁体字幕')
          }
        } else if (siteName === GPW) {
          if (torrentInfo.editionInfo) {
            site.movieEditionCheck.click()
            if (torrentInfo.editionInfo.criterionCollection) { site.movieEditionInfo.criterionCollection.click() }
            if (torrentInfo.editionInfo.directorCut) { site.movieEditionInfo.directorCut.click() }
            if (torrentInfo.editionInfo.unrated) { site.movieEditionInfo.unrated.click() }
            if (torrentInfo.editionInfo.uncut) { site.movieEditionInfo.uncut.click() }
            if (torrentInfo.editionInfo.theatrical) { site.movieEditionInfo.theatrical.click() }
            if (torrentInfo.editionInfo.extended) { site.movieEditionInfo.extended.click() }
            if (torrentInfo.audioInfo.commentary) { site.movieEditionInfo.commentaryAudio.click() }
          }
          const subbed = Object.values(torrentInfo.subtitleInfo).some(x => x)
          site.noSubCheck.checked = !subbed
          site.mixedSubCheck.checked = subbed
          if (subbed) {
            site.otherSubtitlesDiv.removeClass('hidden')
            Object.keys(torrentInfo.subtitleInfo).forEach(lang => {
              if (site.subtitleInfo[lang]) {
                site.subtitleInfo[lang].checked = torrentInfo.subtitleInfo[lang]
              }
            })
          }
          site.chdubCheck.checked = torrentInfo.audioInfo.chineseDub
          site.videoInfo.hdr10.checked = torrentInfo.videoInfo.hdr10
          site.videoInfo.dovi.checked = torrentInfo.videoInfo.dovi
          if (Object.values(site.containerInfo).includes(torrentInfo.videoInfo.container)) {
            site.containerSel.val(torrentInfo.videoInfo.container)
          }
          if (Object.keys(torrentInfo.mediainfo).length > 0) {
            let mediainfoNew = torrentInfo.mediainfoStr
            const completeNameArray = torrentInfo.mediainfo.General['Complete name']
            if (!completeNameArray) {
              const movieNameArray = torrentInfo.mediainfoStr.match(/^Movie name\s*:\s*(.+?)\s*$/mi)
              if (movieNameArray) {
                const completeName = torrentInfo.mediainfo.General['Movie name'] + `.${torrentInfo.videoInfo.container.toLowerCase()}`
                mediainfoNew = torrentInfo.mediainfoStr.replace(/(General\s+Unique ID.+$)\s+(Format\s+.+$)/mi,
                  `$1\nComplete name                            : ${completeName}\n$2`)
              }
            }
            site.mediainfoBox.val(mediainfoNew)
          }
        }
        //= ========================================================================================================
        // handling screenshots
        const description = await generateComparison(siteName, textToConsume, torrentInfo.torrentTitle, torrentInfo.mediainfo, site.maxScreenshots || 10)
        site.descrBox.val(description)
      } catch (error) {
        console.error('Error:', error)
      } finally {
        btnBingo.val(oriTextBingo)
      }
    })
  } else if (page === 'subtitles') {
    //= ========================================================================================================
    // 字幕页面
    // 不需要填充信息的站点
    if (siteName === TTG || siteName === GPW) {
      return
    }
    let inputFile = null; let titleBox = null; let languageSel = null; let anonymousCheck = null
    if (siteName === NHD || siteName === PTER || siteName === PUTAO) {
      inputFile = $('input[type="file"][name="file"]')
      titleBox = $('input[type="text"][name="title"]')
      languageSel = $('select[name="sel_lang"]')
      anonymousCheck = $("input[name='uplver'][type='checkbox']")[0]
    } else if (siteName === MTEAM) {
      inputFile = $('input[type="file"][name="file[]"]')
      titleBox = $('input[type="text"][name="title[]"]')
      languageSel = $('select[name="sel_lang[]"]')
      anonymousCheck = $("input[name='uplver'][type='checkbox']")[0]
    }
    if (!inputFile) {
      return
    }
    inputFile.change(function () {
      if (anonymousCheck) {
        anonymousCheck.checked = anonymous
      }
      let langEng = 1; let langChs = 2; let langCht = 3
      let langJap = 4; let langFre = 5; let langGer = 6; let langIta = 7
      let langKor = 8; let langSpa = 9; let langOther = 10
      let langNum = 0
      const pathSub = inputFile.val()
      const fileName = /([^\\]+)$/.exec(pathSub)[1]
      if (fileName) {
        titleBox.val(fileName)
        const lang = pathSub.replace(/.*\.(.*)\..*/i, '$1')
        if (lang) {
          if (siteName === NHD || siteName === PTER || siteName === PUTAO) {
            langEng = 6; langChs = 25; langCht = 28
            langJap = 15; langFre = 9; langGer = 10; langIta = 14
            langKor = 16; langSpa = 26; langOther = 18
            langNum = lang.match(/(chs|cht|cn|zh)\s*( |&)?.+/) || lang.match(/.+( |&)?(chs|cht|cn|zh)/)
              ? langOther
              : lang.match(/chs/)
                ? langChs
                : lang.match(/cht/)
                  ? langCht
                  : lang.match(/eng/)
                    ? langEng
                    : lang.match(/jap|jp/)
                      ? langJap
                      : lang.match(/fre|fra/)
                        ? langFre
                        : lang.match(/ger/)
                          ? langGer
                          : lang.match(/ita/)
                            ? langIta
                            : lang.match(/kor/)
                              ? langKor
                              : lang.match(/spa/)
                                ? langSpa
                                : langOther
          } else if (siteName === MTEAM) {
            langEng = 6; langChs = 25; langCht = 28
            langJap = 15; langKor = 16; langOther = 18
            langNum = lang.match(/(chs|cht|cn|zh)\s*( |&)?.+/) || lang.match(/.+( |&)?(chs|cht|cn|zh)/)
              ? langOther
              : lang.match(/chs/)
                ? langChs
                : lang.match(/cht/)
                  ? langCht
                  : lang.match(/eng/)
                    ? langEng
                    : lang.match(/jap|jp/)
                      ? langJap
                      : lang.match(/kor/)
                        ? langKor
                        : langOther
          }
        }
        console.log(`language: ${lang}`)
        languageSel.val(langNum)
      } else {
        console.log(`not able to get file name from path ${pathSub}`)
      }
    })
  }
})()
// ////////////////////////////////////////////////////////////////////////////////////////////////
// for unit test
// Conditionally export for unit testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    collectComparisons,
    regexTeam,
    regexTeamsSplitter,
    regexImageUrl,
    regexNormalUrl,
    regexScreenshotsComparison,
    regexScreenshotsThumbsBoxed,
    regexScreenshotsThumbsCombined,
    generateComparison,
    processDescription
  }
}
