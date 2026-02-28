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
            li.textContent = `${raceItem.race_info.track} ${raceItem.race_info.distance} - ${raceItem.race_info.name}`;
            li.dataset.index = index;

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
        renderTop3Bets(currentRaceData.top3_bets);
        renderHorses(currentRaceData.horses);
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

    function renderTop3Bets(top3Data) {
        top3ContainerEl.innerHTML = '';

        const categories = [
            { key: 'win', name: '単勝' },
            { key: 'place', name: '複勝' },
            { key: 'umaren', name: '馬連' },
            { key: 'wide', name: 'ワイド' },
            { key: 'sanrenpuku', name: '3連複' },
            { key: 'sanrentan', name: '3連単' }
        ];

        categories.forEach(cat => {
            const bets = top3Data[cat.key] || [];
            if (bets.length === 0) return;

            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'bet-group';

            let html = `<h3>${cat.name}</h3>`;
            bets.forEach((bet, i) => {
                const isTop = i === 0;
                const evClass = bet.expected_return > 1.0 ? 'ev-high' : (bet.expected_return > 0.8 ? 'ev-mid' : 'ev-low');
                html += `
                    <div class="bet-item">
                        <span class="horse-nums">${bet.numbers.join('-')}</span>
                        <div>
                            <span style="color:var(--text-muted); margin-right:8px;">${bet.odds.toFixed(1)}x</span>
                            <span class="${evClass}">EV:${bet.expected_return.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            });
            categoryDiv.innerHTML = html;
            top3ContainerEl.appendChild(categoryDiv);
        });
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

        // 元のポートフォリオ（推奨ベース）
        let betsPool = [...currentRaceData.portfolios[currentStrategy]];

        // 要求パターン数に足りない場合、top3_betsから広く補充
        if (betsPool.length < maxBetTypes) {
            const allTopBets = [];
            Object.values(currentRaceData.top3_bets).forEach(categoryBets => {
                allTopBets.push(...categoryBets);
            });

            // 期待値順にソート (フィルター条件を大幅に緩和し、単純にtop3_bets内からEVの高い順に補充)
            const sortedExtraBets = allTopBets
                // 既にPoolにあるものは除く
                .filter(b => !betsPool.some(existing => existing.type === b.type && existing.numbers.join('-') === b.numbers.join('-')))
                // 少しでも期待値があれば、予算が余っている場合は買い目に拾う（最低でも0.01以上）
                .filter(b => b.expected_return >= 0.01)
                .sort((a, b) => b.expected_return - a.expected_return);

            betsPool = [...betsPool, ...sortedExtraBets].slice(0, maxBetTypes);
        } else {
            betsPool = betsPool.slice(0, maxBetTypes);
        }

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
        const summaryHtml = `
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

        allocationResultsEl.innerHTML = html + summaryHtml;
    }

    init();
});
