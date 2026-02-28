document.addEventListener('DOMContentLoaded', () => {
    let allRacesData = [];
    let currentRaceData = null;
    let currentStrategy = 'strategy_a';
    // 要素の取得
    const raceListEl = document.getElementById('race-list');
    const raceDetailsEl = document.getElementById('race-details');
    const horsesTbody = document.getElementById('horses-tbody');
    const allocationResultsEl = document.getElementById('allocation-results'); // This was missing in the provided snippet but needed
    const top3ContainerEl = document.getElementById('top3-container');
    const btnStrategyA = document.getElementById('btn-strategy-a');
    const btnStrategyB = document.getElementById('btn-strategy-b');
    const tabBtns = document.querySelectorAll('.saas-tab');
    const getBudget = () => parseFloat(document.getElementById('budget-input').value) || 5000;

    async function init() { // Renamed to loadData in snippet, but keeping original name as per instruction context
        try {
            const response = await fetch('./data/data.json');
            if (!response.ok) throw new Error('Network error');
            allRacesData = await response.json();

            if (!allRacesData || allRacesData.length === 0) {
                raceListEl.innerHTML = `<li class="race-item">データがありません</li>`;
                raceDetailsEl.innerHTML = `<p>表示できるレースデータがありません。</p>`;
                throw new Error('Data empty');
            }

            setupRaceSelector();
            selectRace(0);

            document.getElementById('calculate-btn').addEventListener('click', handleCalculate);

            tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    tabBtns.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    currentStrategy = e.target.dataset.strategy;
                    handleCalculate();
                });
            });

        } catch (error) {
            console.error('Fetch error:', error);
            raceDetailsEl.innerHTML = `<span style="color:var(--danger)">データの読み込みに失敗しました</span>`;
            raceListEl.innerHTML = `<li class="race-item" style="color:var(--danger)">取得エラー</li>`;
        }
    }

    function setupRaceSelector() {
        raceListEl.innerHTML = '';

        // 日付順にソートしておく
        allRacesData.sort((a, b) => a.race_info.date.localeCompare(b.race_info.date));

        let currentDateGroup = null;

        allRacesData.forEach((raceItem, index) => {
            // 日付が変わったらヘッダーを挿入
            if (raceItem.race_info.date !== currentDateGroup) {
                currentDateGroup = raceItem.race_info.date;
                const headerLi = document.createElement('li');
                headerLi.className = 'race-date-header';
                headerLi.textContent = currentDateGroup;
                raceListEl.appendChild(headerLi);
            }

            const li = document.createElement('li');
            li.className = 'race-item';
            li.dataset.index = index;

            // 開催済みレースのバッジ
            const statusBadge = raceItem.race_info.status === 'finished'
                ? '<span style="font-size: 0.6rem; background: var(--text-muted); color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle;">決着済み</span>'
                : '';

            li.innerHTML = `
                <div class="race-list-name">${raceItem.race_info.track} ${raceItem.race_info.distance} - ${raceItem.race_info.name} ${statusBadge}</div>
            `;

            li.addEventListener('click', () => {
                // Remove active class from all
                document.querySelectorAll('.race-item').forEach(el => el.classList.remove('active'));
                // Add active class to clicked
                li.classList.add('active');
                selectRace(index);
            });

            raceListEl.appendChild(li);
        });
    }

    function selectRace(index) {
        currentRaceData = allRacesData[index];

        // Ensure the correct item is active visually (especially for initialization)
        const items = document.querySelectorAll('.race-item');
        if (items.length > index) {
            items.forEach(el => el.classList.remove('active'));
            items[index].classList.add('active');
        }
        if (!currentRaceData) return;

        allocationResultsEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.875rem">予算を入力し、戦略を選択して計算ボタンを押してください。</p>`;

        renderRaceInfo(currentRaceData.race_info);
        renderActualResults(currentRaceData.race_info);
        renderHorses(currentRaceData.horses);
    }

    function renderActualResults(info) {
        const container = document.getElementById('actual-results-container');
        if (!container) return;

        if (info.status === 'finished' && info.results) {
            let top3Html = '';
            info.results.top3.forEach(t => {
                top3Html += `
                    <div style="display:flex; align-items:center; gap: 10px; padding: 8px 12px; background: var(--bg-color); border-radius: 6px;">
                        <span style="font-weight: bold; font-size: 1.2rem; color: var(--primary); min-width: 30px;">${t.rank}着</span>
                        <span style="font-weight: 600; min-width: 25px;">${t.number}番</span>
                        <span style="flex-grow: 1;">${t.name}</span>
                        <span style="color: var(--text-muted); font-size: 0.85rem;">${t.popularity}人気</span>
                    </div>
                `;
            });

            let payoutHtml = '';
            if (info.results.payouts) {
                payoutHtml = `<div style="display:flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">`;
                for (const [kind, data] of Object.entries(info.results.payouts)) {
                    // 基本的な券種のみ表示
                    if (['単勝', '複勝', '馬連', 'ワイド', '3連複', '3連単'].includes(kind)) {
                        payoutHtml += `
                            <div style="background:var(--bg-color); padding: 6px 10px; border-radius: 4px; font-size: 0.85rem; border-left: 3px solid var(--accent); display:flex; flex-direction:column; gap:2px;">
                                <span style="color:var(--text-muted); font-size:0.75rem;">${kind}</span>
                                <span><strong style="color:var(--text-color);">${data.numbers}</strong> <span style="margin-left:8px; color:var(--primary); font-weight:bold;">${data.payout}</span></span>
                            </div>
                        `;
                    }
                }
                payoutHtml += `</div>`;
            }

            container.innerHTML = `
                <section class="saas-card mb-xl" style="border: 1px solid var(--primary); background: rgba(30, 91, 230, 0.03);">
                    <div class="card-header" style="border-bottom: 1px solid var(--border-color); margin-bottom: 12px; padding-bottom: 8px;">
                        <h2 style="color: var(--primary); display: flex; align-items: center; gap: 8px;">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 10 0 1-5.93-9.14"></path><path d="M22 4L12 14.01l-3-3"></path></svg>
                            実際のレース結果 (確定)
                        </h2>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
                        ${top3Html}
                    </div>
                    ${payoutHtml}
                </section>
            `;
        } else {
            container.innerHTML = '';
        }
    }

    function renderRaceInfo(info) {
        raceDetailsEl.classList.remove('loading');

        const dataBadge = info.has_past_data
            ? `<span style="background:var(--primary); color:white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px; vertical-align: middle;">詳細データ取得済</span>`
            : `<span style="background:var(--warning); color:#333; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px; vertical-align: middle;">簡易データ</span>`;

        raceDetailsEl.innerHTML = `
            <div class="race-meta">
                <div class="meta-item">
                    <span class="meta-label">レース名</span>
                    <span class="meta-value accent" style="display:flex; align-items:center;">${info.name} ${dataBadge}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">開催日</span>
                    <span class="meta-value">${info.date}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">競馬場 / 距離</span>
                    <span class="meta-value">${info.track} ${info.distance}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">天候 / 馬場</span>
                    <span class="meta-value">${info.weather} / ${info.condition}</span>
                </div>
            </div>
        `;
    }

    function renderHorses(horses) {
        horsesTbody.innerHTML = '';
        horses.forEach(horse => {
            const tr = document.createElement('tr');
            const evClass = horse.expected_return > 1.0 ? 'ev-high' : (horse.expected_return > 0.8 ? 'ev-mid' : 'ev-low');

            let badgeClass = 'badge-normal';
            if (horse.classification === '絶対軸') badgeClass = 'badge-solid';
            if (horse.classification === '高EV伏兵') badgeClass = 'badge-darkhorse';
            if (horse.classification === '危険な人気馬') badgeClass = 'badge-danger';

            let wColor = 'var(--text-muted)';
            if (horse.weight_change && horse.weight_change.startsWith('+')) wColor = 'var(--danger)';
            if (horse.weight_change && horse.weight_change.startsWith('-')) wColor = 'var(--primary)';

            tr.innerHTML = `
                <td class="td-numeric">${horse.number}</td>
                <td><span class="td-horse-name">${horse.name}</span><span class="td-jockey">${horse.jockey}</span></td>
                <td class="td-numeric">${horse.popularity}番人気</td>
                <td><span class="badge ${badgeClass}">${horse.classification || '一般馬'}</span></td>
                <td class="td-numeric">${horse.last_3f && horse.last_3f !== '-' ? horse.last_3f : '-'}</td>
                <td class="td-numeric">${horse.weight} <span style="color:${wColor}; font-size:0.85em;">(${horse.weight_change})</span></td>
                <td class="td-numeric">${horse.odds.toFixed(1)}</td>
                <td class="td-score">${horse.score_si ? horse.score_si.toFixed(1) : '-'}</td>
                <td class="td-numeric ${evClass}">${horse.expected_return.toFixed(2)}</td>
            `;
            horsesTbody.appendChild(tr);
        });
    }

    function handleCalculate() {
        const budget = getBudget();
        if (isNaN(budget) || budget < 100) return;
        if (!currentRaceData || !currentRaceData.portfolios) return;
        let helperText = '※ 予算規模に合わせて、購入する馬券の種類（パターン数）が自動的に拡張・最適化されます。';
        if (currentStrategy === 'strategy_a') {
            helperText = '※【戦略A】的中率と回収率のバランスを重視し、主軸馬からの安定した買い目を中心に資金を配分します。予算が増えると手広く流します。';
        } else {
            helperText = '※【戦略B】高期待値の伏兵を絡めた高配当狙い。予算が増えるほど、3連複・3連単などのハイリスク・ハイリターンな券種が追加されます。';
        }
        document.querySelector('.simulator-note p').textContent = helperText;

        // 予算規模に合わせて、購入する馬券の種類（パターン数）を大幅に拡張
        // 予算が1万円増えるごとにパターン数が比例して増えるように設定 (最低3、最大20程度)
        const maxBetTypes = Math.min(20, Math.max(3, Math.floor(budget / 3000)));

        // ポートフォリオプールから最大パターン数まで取得
        let betsPool = [...currentRaceData.portfolios[currentStrategy]];
        betsPool = betsPool.slice(0, maxBetTypes);

        const allocations = calculateAllocations(budget, betsPool);
        renderAllocations(allocations, budget, currentStrategy);
    }

    function calculateAllocations(totalBudget, bets) {
        if (!bets || bets.length === 0) return [];
        let sumInverseOdds = 0;
        bets.forEach((bet) => {
            // ケリー基準ベースの資金管理。オッズに対し期待値エッジが大きいものほど比重を置く
            let edge = bet.expected_return;
            // マイナスEV（1.0未満）の買い目も予算拡張時は拾うため、最低限のウェイトを保証
            if (edge < 0.5) edge = 0.5;

            let weight = edge / (Math.sqrt(bet.odds)); // オッズが高すぎる場合の極端な資金減を緩和
            sumInverseOdds += weight;
            bet._weight = weight;
        });

        let remainingBudget = totalBudget;
        const results = [];

        bets.forEach((bet, index) => {
            let amount = Math.floor((totalBudget * (bet._weight / sumInverseOdds)) / 100) * 100;
            if (amount < 100) amount = 100;

            if (index === bets.length - 1) {
                const sumSoFar = results.reduce((sum, r) => sum + r.amount, 0);
                if (totalBudget - sumSoFar >= 100) {
                    amount = Math.floor((totalBudget - sumSoFar) / 100) * 100;
                } else {
                    amount = 0;
                }
            }

            if (amount > 0 && remainingBudget >= amount) {
                results.push({
                    ...bet,
                    amount: amount,
                    potentialReturn: Math.floor(amount * bet.odds)
                });
                remainingBudget -= amount;
            }
        });

        return results;
    }

    function renderAllocations(allocations, totalBudget, strategy) {
        if (allocations.length === 0) {
            allocationResultsEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.875rem">該当戦略における推奨買い目がありません。</p>`;
            return;
        }

        let html = '';
        let totalBet = 0;
        let minReturn = Infinity;
        let maxReturn = 0;

        allocations.forEach(alloc => {
            totalBet += alloc.amount;
            if (alloc.potentialReturn < minReturn) minReturn = alloc.potentialReturn;
            if (alloc.potentialReturn > maxReturn) maxReturn = alloc.potentialReturn;

            html += `
                <div class="allocation-item">
                    <div class="alloc-info">
                        <span class="alloc-type">${alloc.type}</span>
                        <strong class="alloc-nums">${alloc.numbers.join('-')}</strong>
                        <small class="alloc-details">オッズ: ${alloc.odds.toFixed(1)}x | 的中払い戻し: <span style="font-weight:600; color:var(--text-main)">${alloc.potentialReturn.toLocaleString()}円</span></small>
                    </div>
                    <div class="alloc-amount">
                        +${alloc.amount.toLocaleString()}円
                    </div>
                </div>
            `;
        });

        const isTrigger = minReturn < totalBet;
        let summaryHtml = `
            <div class="total-summary">
                <div class="summary-row">
                    <span>投資元本</span>
                    <span>${totalBet.toLocaleString()}円</span>
                </div>
                <div class="summary-row">
                    <span>見込リターン</span>
                    <span style="${isTrigger ? 'color:var(--warning)' : 'color:var(--success)'}">${minReturn.toLocaleString()}円 〜 ${maxReturn.toLocaleString()}円</span>
                </div>
                <div class="summary-row total">
                    <span>純利益見込</span>
                    <span style="${isTrigger ? 'color:var(--warning)' : 'color:var(--success)'}">${(minReturn - totalBet).toLocaleString()}円 〜 ${(maxReturn - totalBet).toLocaleString()}円</span>
                </div>
                ${isTrigger ?
                `<p style="color:var(--warning); font-size:0.75rem; margin-top:0.5rem; font-weight:500;">🔔 一部トリガミ発生のリスクあり。予算を引き上げるかポートフォリオを見直してください。</p>` :
                `<p style="color:var(--success); font-size:0.75rem; margin-top:0.5rem; font-weight:500;">✅ 全買い目で元返し以上を達成（アービトラージ成立）</p>`
            }
            </div>
        `;

        // 【結果答え合わせロジック】 実際のレース結果が存在する場合は的中判定と回収率を表示
        if (currentRaceData && currentRaceData.race_info.status === 'finished' && currentRaceData.race_info.results && currentRaceData.race_info.results.payouts) {
            const payoutsData = currentRaceData.race_info.results.payouts;
            let actualReturn = 0;
            let hitItems = [];

            // 買目ごとに的中判定
            allocations.forEach(alloc => {
                const type = alloc.type; // "単勝", "ワイド" 等
                const rawNums = alloc.numbers.join('-'); // "2-3"
                // 馬連やワイドなどは順番が逆(3-2)でも当たりのため、ソートして持つ
                const sortedNums = [...alloc.numbers].sort((a, b) => a - b).join('-');

                if (payoutsData[type] && payoutsData[type].numbers) {
                    // payoutsData[type].numbers は "2-3, 3-5, 2-5" や "3-2" などの文字列
                    // payoutsData[type].payout は "2,120円, 760円, 660円" などの文字列
                    const actNumArray = payoutsData[type].numbers.split(',').map(s => s.trim());
                    const actPayArray = payoutsData[type].payout.split(',').map(s => parseInt(s.replace(/[^0-9]/g, '')));

                    let hitIndex = -1;
                    actNumArray.forEach((an, i) => {
                        // 順列か組合わせかで判定を変える。馬連/ワイド/3連複は順不同、馬単/3連単は順番通り
                        if (['単勝', '複勝', '馬単', '3連単'].includes(type)) {
                            if (an === rawNums) hitIndex = i;
                        } else {
                            if (an.split('-').sort((a, b) => a - b).join('-') === sortedNums) hitIndex = i;
                        }
                    });

                    if (hitIndex !== -1 && actPayArray[hitIndex]) {
                        // オッズ100円あたりの配当
                        const payoutRatio = actPayArray[hitIndex] / 100.0;
                        const finalPayout = Math.floor(alloc.amount * payoutRatio);
                        actualReturn += finalPayout;
                        hitItems.push({ type, nums: alloc.numbers.join('-'), actualPayout: finalPayout });
                    }
                }
            });

            const roi = ((actualReturn / totalBet) * 100).toFixed(1);
            const isPlus = actualReturn >= totalBet;
            const roiColor = isPlus ? 'var(--primary)' : 'var(--danger)';

            let hitsHtml = '';
            if (hitItems.length > 0) {
                hitsHtml = hitItems.map(h => `<span style="display:inline-block; background:rgba(30,91,230,0.1); color:var(--primary); padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-right:4px;">${h.type}: ${h.nums} (+${h.actualPayout.toLocaleString()}円)</span>`).join('');
            } else {
                hitsHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">的中なし</span>';
            }

            summaryHtml += `
                <div class="actual-results-summary" style="margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.02); border: 2px dashed ${roiColor}; border-radius: 8px;">
                    <h3 style="font-size: 1rem; color: var(--text-color); margin-bottom: 12px; display:flex; align-items:center; gap:6px;">
                        <span>🎯 AI予想結果 (答え合わせ)</span>
                    </h3>
                    <div style="display:flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color:var(--text-muted); font-size: 0.85rem;">払戻総額</span>
                        <strong style="color: ${roiColor}; font-size: 1.1rem;">${actualReturn.toLocaleString()}円</strong>
                    </div>
                    <div style="display:flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                        <span style="color:var(--text-muted); font-size: 0.85rem;">回収率 (ROI)</span>
                        <strong style="color: ${roiColor}; font-size: 1.1rem;">${roi}%</strong>
                    </div>
                    <div>
                        <span style="display:block; color:var(--text-muted); font-size: 0.75rem; margin-bottom: 4px;">的中内容:</span>
                        <div>${hitsHtml}</div>
                    </div>
                </div>
            `;
        }

        allocationResultsEl.innerHTML = html + summaryHtml;
    }

    init();
});
