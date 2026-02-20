/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  푸르니 어린이집 알림장 백업 도구 📔                   ║
 * ║  Playwright 기반 자동 로그인 + 전체 크롤링             ║
 * ╚══════════════════════════════════════════════════════╝
 * 
 * 사용법:
 *   node scraper.js --id=아이디 --pw=비밀번호
 * 
 * 옵션:
 *   --id        : 푸르니 로그인 아이디 (필수)
 *   --pw        : 푸르니 로그인 비밀번호 (필수)
 *   --child     : childkey (기본값: 자동 감지)
 *   --class     : classCd (기본값: 자동 감지)
 *   --output    : 저장 폴더 (기본값: ./downloaded)
 *   --headless  : 브라우저 숨김 모드 (기본값: false)
 *   --start     : 시작 페이지 (기본값: 1)
 *   --end       : 종료 페이지 (기본값: 마지막 페이지)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Parse CLI Arguments ───
function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
            args[key] = valueParts.join('=') || true;
        }
    });
    return args;
}

const args = parseArgs();

const CONFIG = {
    userId: args.id || '',
    userPw: args.pw || '',
    childKey: args.child || '',
    classCd: args.class || '',
    outputDir: args.output || './downloaded',
    headless: args.headless === 'true',
    startPage: parseInt(args.start) || 1,
    endPage: parseInt(args.end) || 0,  // 0 = auto-detect
    baseUrl: 'https://www.puruni.com',
    centerFlag: 'gmk',
};

if (!CONFIG.userId || !CONFIG.userPw) {
    console.error('❌ 사용법: node scraper.js --id=아이디 --pw=비밀번호');
    console.error('');
    console.error('옵션:');
    console.error('  --child=74847           원아 키 (기본: 자동 감지)');
    console.error('  --class=14267587916477  반 코드 (기본: 자동 감지)');
    console.error('  --output=./downloaded   저장 폴더');
    console.error('  --headless=true         브라우저 숨김 모드');
    console.error('  --start=1              시작 페이지');
    console.error('  --end=87               종료 페이지');
    process.exit(1);
}

// ─── Utility Functions ───
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeFilename(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
}

function downloadFile(url, destPath, cookieStr) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const opts = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookieStr,
                'Referer': `${CONFIG.baseUrl}/${CONFIG.centerFlag}/`,
            },
        };

        const doRequest = (reqUrl, depth = 0) => {
            if (depth > 5) return reject(new Error('Too many redirects'));
            const pu = new URL(reqUrl);
            const proto = pu.protocol === 'https:' ? https : http;

            proto.get({
                hostname: pu.hostname,
                path: pu.pathname + pu.search,
                headers: opts.headers,
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const next = res.headers.location.startsWith('http')
                        ? res.headers.location
                        : `${pu.protocol}//${pu.hostname}${res.headers.location}`;
                    return doRequest(next, depth + 1);
                }
                if (res.statusCode !== 200) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                const fileStream = fs.createWriteStream(destPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => { fileStream.close(); resolve(); });
                fileStream.on('error', reject);
            }).on('error', reject);
        };

        doRequest(url);
    });
}

// ─── Main Scraper ───
async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  🏫 푸르니 어린이집 알림장 백업 도구              ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`👤 아이디: ${CONFIG.userId}`);
    console.log(`📁 저장: ${path.resolve(CONFIG.outputDir)}`);
    console.log(`🖥️  모드: ${CONFIG.headless ? '헤드리스' : '브라우저 표시'}`);
    console.log('');

    ensureDir(CONFIG.outputDir);

    const browser = await chromium.launch({
        headless: CONFIG.headless,
        slowMo: 50,
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Handle dialogs
    page.on('dialog', async dialog => {
        console.log(`   ⚠️ Alert: ${dialog.message()}`);
        await dialog.accept();
    });

    try {
        // ════════════════════════════════════════
        // STEP 1: LOGIN
        // ════════════════════════════════════════
        console.log('🔐 [1/4] 로그인 중...');

        // Go to main page first, then click login
        await page.goto(`${CONFIG.baseUrl}/${CONFIG.centerFlag}`, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(1000);

        await page.click(`a[href="/${CONFIG.centerFlag}/_main/login"]`);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
        await page.waitForSelector('#userCd', { timeout: 10000 });

        await page.fill('#userCd', CONFIG.userId);
        await page.fill('#userPs', CONFIG.userPw);

        await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => { }),
            page.click('.btn-sign-in.btn-blue'),
        ]);
        await sleep(2000);

        if (page.url().includes('login')) {
            console.log('   ❌ 로그인 실패! 아이디/비밀번호를 확인하세요.');
            await browser.close();
            return;
        }
        console.log('   ✅ 로그인 성공!');

        // ════════════════════════════════════════
        // STEP 2: NAVIGATE TO NOTIFICATION LIST & AUTO-DETECT SETTINGS
        // ════════════════════════════════════════
        console.log('\n📋 [2/4] 알림장 목록 탐색...');

        // If classCd or childKey not provided, auto-detect from noti_list page
        let notiListUrl = `${CONFIG.baseUrl}/${CONFIG.centerFlag}/_story/noti_list`;
        if (CONFIG.classCd && CONFIG.childKey) {
            notiListUrl += `/1?ndate=&classCd=${CONFIG.classCd}&childkey=${CONFIG.childKey}`;
        }

        await page.goto(notiListUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await sleep(2000);

        // Auto-detect classCd and childKey if not provided
        if (!CONFIG.classCd || !CONFIG.childKey) {
            const detected = await page.evaluate(() => {
                const classCdEl = document.querySelector('#classCd');
                const childkeyEl = document.querySelector('#childkey');

                const classes = [];
                if (classCdEl) {
                    Array.from(classCdEl.options).forEach(opt => {
                        if (opt.value) classes.push({ value: opt.value, name: opt.text });
                    });
                }

                const children = [];
                if (childkeyEl) {
                    Array.from(childkeyEl.options).forEach(opt => {
                        if (opt.value) children.push({ value: opt.value, name: opt.text });
                    });
                }

                return {
                    selectedClass: classCdEl ? classCdEl.value : '',
                    selectedChild: childkeyEl ? childkeyEl.value : '',
                    classes,
                    children,
                };
            });

            console.log('   📌 감지된 반 목록:');
            detected.classes.forEach(c => console.log(`      ${c.name} (${c.value})`));
            console.log('   📌 감지된 원아:');
            detected.children.forEach(c => console.log(`      ${c.name} (${c.value})`));

            if (!CONFIG.classCd) CONFIG.classCd = detected.selectedClass || detected.classes[0]?.value;
            if (!CONFIG.childKey) CONFIG.childKey = detected.selectedChild || detected.children[0]?.value;

            if (!CONFIG.classCd || !CONFIG.childKey) {
                console.log('   ❌ 반/원아 정보를 감지할 수 없습니다. --class, --child 파라미터를 직접 지정해주세요.');
                await browser.close();
                return;
            }

            // Navigate with detected values
            notiListUrl = `${CONFIG.baseUrl}/${CONFIG.centerFlag}/_story/noti_list/1?ndate=&classCd=${CONFIG.classCd}&childkey=${CONFIG.childKey}`;
            await page.goto(notiListUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await sleep(2000);
        }

        console.log(`   📌 반 코드: ${CONFIG.classCd}`);
        console.log(`   📌 원아 키: ${CONFIG.childKey}`);

        // Detect total pages
        const totalPages = await page.evaluate(() => {
            const lastLink = document.querySelector('.paging a.last');
            if (lastLink) {
                const match = lastLink.href.match(/pageSubmit\((\d+)\)/);
                if (match) return parseInt(match[1]);
            }
            // Fallback: count pagination links
            const pageLinks = document.querySelectorAll('.paging a');
            let maxPage = 1;
            pageLinks.forEach(a => {
                const m = a.href.match(/pageSubmit\((\d+)\)/);
                if (m) maxPage = Math.max(maxPage, parseInt(m[1]));
            });
            return maxPage;
        });

        const endPage = CONFIG.endPage || totalPages;
        console.log(`   📄 총 ${totalPages} 페이지 (${CONFIG.startPage}~${endPage} 페이지 다운로드 예정)`);

        // Get cookies for image downloads
        const browserCookies = await context.cookies();
        const cookieStr = browserCookies.map(c => `${c.name}=${c.value}`).join('; ');

        // ════════════════════════════════════════
        // STEP 3: CRAWL ALL PAGES
        // ════════════════════════════════════════
        console.log('\n📥 [3/4] 알림장 다운로드 시작...');

        let totalNotifications = 0;
        let totalPhotos = 0;
        const allData = [];
        const startTime = Date.now();

        for (let pageNum = CONFIG.startPage; pageNum <= endPage; pageNum++) {
            const pageUrl = `${CONFIG.baseUrl}/${CONFIG.centerFlag}/_story/noti_list/${pageNum}?ndate=&classCd=${CONFIG.classCd}&childkey=${CONFIG.childKey}`;

            console.log(`\n── 페이지 ${pageNum}/${endPage} ──`);
            await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await sleep(1500);

            // Extract notification items from this page
            const items = await page.evaluate(() => {
                const results = [];
                const rows = document.querySelectorAll('.board-td li');

                rows.forEach(row => {
                    const numEl = row.querySelector('.num');
                    const sjEl = row.querySelector('.sj a');
                    const dateEl = row.querySelector('.date2');

                    if (sjEl) {
                        const onclickAttr = sjEl.getAttribute('onclick') || '';
                        const match = onclickAttr.match(/pageView\((\d+),\s*(\d+),\s*'([^']+)'\)/);

                        if (match) {
                            results.push({
                                num: numEl ? numEl.innerText.trim() : '',
                                title: sjEl.innerText.trim(),
                                bkey: match[2],
                                date: match[3],
                                pageNum: parseInt(match[1]),
                            });
                        }
                    }
                });

                return results;
            });

            console.log(`   📝 ${items.length}개 알림장 발견`);

            // Process each notification
            for (const item of items) {
                totalNotifications++;
                const dateFolder = sanitizeFilename(item.date);
                const notiDir = path.join(CONFIG.outputDir, dateFolder);
                ensureDir(notiDir);

                // Navigate to detail page
                const viewUrl = `${CONFIG.baseUrl}/${CONFIG.centerFlag}/_story/noti_view/${item.pageNum}/${item.bkey}?ndate=${item.date}&classCd=${CONFIG.classCd}&childkey=${CONFIG.childKey}`;

                try {
                    await page.goto(viewUrl, { waitUntil: 'networkidle', timeout: 20000 });
                    await sleep(1000);

                    // Extract detail content - TEACHER section only
                    const detail = await page.evaluate(() => {
                        // Page structure:
                        //   1st .board-view → h4 "부모(원아이름)" = parent check-in (SKIP)
                        //   2nd .board-view → h4 "교사"          = teacher's message (CAPTURE)

                        const boardViews = document.querySelectorAll('.board-view');
                        let teacherSection = null;

                        // Find the teacher section (교사)
                        boardViews.forEach(section => {
                            const h4 = section.querySelector('h4.title1');
                            if (h4 && h4.innerText.trim() === '교사') {
                                teacherSection = section;
                            }
                        });

                        let teacherMessage = '';
                        const images = [];

                        if (teacherSection) {
                            const detail = teacherSection.querySelector('.board-detail');
                            if (detail) {
                                // Get images from lightbox anchors (full-res URLs)
                                detail.querySelectorAll('a.example-image-link').forEach(a => {
                                    const href = a.getAttribute('href');
                                    if (href && href.includes('img.puruni.com')) {
                                        images.push(href);
                                    }
                                });

                                // Also check img tags directly (fallback)
                                if (images.length === 0) {
                                    detail.querySelectorAll('img.example-image, img').forEach(img => {
                                        if (img.src && img.src.includes('img.puruni.com')) {
                                            images.push(img.src);
                                        }
                                    });
                                }

                                // Get teacher's text message
                                // The text is directly in .board-detail, after the .img-box div
                                // Clone the node, remove img-box and h5, get remaining text
                                const clone = detail.cloneNode(true);
                                const imgBox = clone.querySelector('.img-box');
                                if (imgBox) imgBox.remove();
                                const h5 = clone.querySelector('h5');
                                if (h5) h5.remove();

                                teacherMessage = clone.innerText.trim();
                            }
                        }

                        // Also get parent's written message (not the checklist)
                        // Some parents write longer messages under "가정에서 이렇게 지냈어요!"
                        let parentMessage = '';
                        boardViews.forEach(section => {
                            const h4 = section.querySelector('h4.title1');
                            if (h4 && h4.innerText.trim() !== '교사') {
                                const detail = section.querySelector('.board-detail');
                                if (detail) {
                                    const clone = detail.cloneNode(true);
                                    const imgBox = clone.querySelector('.img-box');
                                    if (imgBox) imgBox.remove();
                                    const h5 = clone.querySelector('h5');
                                    if (h5) h5.remove();
                                    const txt = clone.innerText.trim();
                                    // Only include if it's a substantial message (not empty/very short)
                                    if (txt.length > 5) parentMessage = txt;
                                }
                            }
                        });

                        return {
                            teacherMessage,
                            parentMessage,
                            images: [...new Set(images)]
                        };
                    });

                    // Save teacher message
                    if (detail.teacherMessage) {
                        const msgPath = path.join(notiDir, `${item.date}_message.txt`);
                        fs.writeFileSync(msgPath, detail.teacherMessage, 'utf-8');
                    }

                    // Save parent message separately (if substantial)
                    if (detail.parentMessage) {
                        const parentMsgPath = path.join(notiDir, `${item.date}_parent_message.txt`);
                        fs.writeFileSync(parentMsgPath, detail.parentMessage, 'utf-8');
                    }

                    // Download images
                    for (let i = 0; i < detail.images.length; i++) {
                        const imgUrl = detail.images[i];
                        try {
                            const urlObj = new URL(imgUrl);
                            const ext = path.extname(urlObj.pathname).toLowerCase() || '.jpg';
                            const filename = `${item.date}_photo_${String(i + 1).padStart(2, '0')}${ext}`;
                            const destPath = path.join(notiDir, filename);

                            if (!fs.existsSync(destPath)) {
                                await downloadFile(imgUrl, destPath, cookieStr);
                                totalPhotos++;
                            }
                        } catch (err) {
                            console.log(`      ⚠️ 이미지 실패: ${err.message}`);
                        }
                    }

                    const photoInfo = detail.images.length > 0 ? `📸${detail.images.length}` : '';
                    const msgInfo = detail.teacherMessage ? '✉️' : '';
                    process.stdout.write(`   ${item.date} [#${item.num}] ${msgInfo}${photoInfo}\n`);

                    allData.push({
                        num: item.num,
                        date: item.date,
                        bkey: item.bkey,
                        teacherMessageLength: detail.teacherMessage?.length || 0,
                        parentMessageLength: detail.parentMessage?.length || 0,
                        photoCount: detail.images.length,
                        folder: dateFolder,
                    });

                } catch (err) {
                    console.log(`   ⚠️ ${item.date} 처리 실패: ${err.message}`);
                }

                await sleep(500); // Server-friendly delay
            }
        }

        // ════════════════════════════════════════
        // STEP 4: SUMMARY
        // ════════════════════════════════════════
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        const summary = {
            downloadDate: new Date().toISOString(),
            userId: CONFIG.userId,
            classCd: CONFIG.classCd,
            childKey: CONFIG.childKey,
            pagesProcessed: `${CONFIG.startPage}-${CONFIG.endPage || totalPages}`,
            totalNotifications,
            totalPhotos,
            elapsedSeconds: elapsed,
            notifications: allData,
        };

        fs.writeFileSync(
            path.join(CONFIG.outputDir, '_backup_summary.json'),
            JSON.stringify(summary, null, 2),
            'utf-8'
        );

        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║              📊 백업 완료!                        ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log(`📄 처리 페이지: ${CONFIG.startPage}~${CONFIG.endPage || totalPages}`);
        console.log(`📝 총 알림장: ${totalNotifications}개`);
        console.log(`📸 총 사진: ${totalPhotos}장`);
        console.log(`⏱️  소요 시간: ${Math.floor(elapsed / 60)}분 ${elapsed % 60}초`);
        console.log(`📁 저장 위치: ${path.resolve(CONFIG.outputDir)}`);

    } catch (error) {
        console.error('\n❌ 오류:', error.message);
        await page.screenshot({ path: path.join(CONFIG.outputDir, '_error.png') });
        const html = await page.content();
        fs.writeFileSync(path.join(CONFIG.outputDir, '_error_page.html'), html, 'utf-8');
        console.log('   📸 에러 스크린샷/HTML 저장됨');
    } finally {
        await browser.close();
        console.log('\n🏁 브라우저 종료');
    }
}

main().catch(err => {
    console.error('❌ 치명적 오류:', err);
    process.exit(1);
});
