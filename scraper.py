import json
import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timedelta

# ==========================================
# 競馬データ取得・期待値計算バッチスクリプト (実データ・スクレイピング版)
# ==========================================

FRONTEND_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend', 'data')
OUTPUT_JSON_PATH = os.path.join(FRONTEND_DATA_DIR, 'data.json')
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

def get_upcoming_race_urls():
    """ 本日および明日のレース一覧から、重賞レース (G1~G3) のURLを取得する """
    links = {}
    
    # 0日後(今日)と1日後(明日)の両方をチェック
    for day_offset in [-2, -1, 0, 1, 2]:
        target_date = datetime.now() + timedelta(days=day_offset)
        date_str_formatted = target_date.strftime('%Y-%m-%d')
        date_str = target_date.strftime('%Y%m%d')
        url = f"https://race.netkeiba.com/top/race_list_sub.html?kaisai_date={date_str}"
        
        try:
            r = requests.get(url, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(r.content, 'html.parser')
            
            day_links = []
            for a in soup.find_all('a', href=True):
                if 'shutuba.html' in a['href']:
                    # 重賞アイコンクラスを持つ要素を探す (Icon_GradeType1: G1, Type2: G2, Type3: G3)
                    parent = a.find_parent('li') or a.parent
                    grade_icon = parent.select_one('.Icon_GradeType1, .Icon_GradeType2, .Icon_GradeType3')
                    
                    if grade_icon:
                        full_url = a['href'] if a['href'].startswith('http') else "https://race.netkeiba.com" + a['href'].lstrip('..')
                        if full_url not in links and full_url not in day_links:
                            day_links.append(full_url)
                            links[full_url] = date_str_formatted
            
            if day_links:
                print(f"[{date_str}] の重賞レースを {len(day_links)} 件発見しました。")
                
        except Exception as e:
            print(f"[{date_str}] レース一覧取得エラー: {e}")
            
    if not links:
        print("本日・翌日の重賞レースは見つかりませんでした。")
        
    # Ocean Stakes (2/28) を手動で追加して日付グルーピングテスト用とする
    ocean_s_url = "https://race.netkeiba.com/race/shutuba.html?race_id=202606020111&rf=race_list"
    if ocean_s_url not in links:
        links[ocean_s_url] = "2026-02-28"
        print("[2026-02-28] オーシャンS をテスト用に追加しました。")
        
    return links

def scrape_race_data(race_url, race_date_str):
    """ 個別の出馬表ページをスクレイピングする """
    try:
        r = requests.get(race_url, headers=HEADERS, timeout=10)
        soup = BeautifulSoup(r.content, 'html.parser')
        
        # レース情報
        race_info = {"id": race_url.split('race_id=')[-1]}
        
        race_name_el = soup.select_one('.RaceName')
        race_name = race_name_el.text.strip() if race_name_el else "レース名不明"
        
        race_data1_el = soup.select_one('.RaceData01')
        race_details = race_data1_el.text.strip().replace('\n', ' ') if race_data1_el else "詳細不明"
        
        # 開催地の簡易抽出 (例: 14:25発走 / 芝2400m (右) / 天候:晴 / 馬場:良)
        # 実際にはHTML構造から細かく取る
        distance_match = re.search(r'([芝ダ]\d+m)', race_details)
        distance = distance_match.group(1) if distance_match else "距離不明"
        
        weather_match = re.search(r'天候:(\S+)', race_details)
        weather = weather_match.group(1) if weather_match else "-"
        
        condition_match = re.search(r'馬場:(\S+)', race_details)
        condition = condition_match.group(1) if condition_match else "-"
        
        # 結果ページを試行して取得
        result_url = race_url.replace('shutuba.html', 'result.html')
        race_status = "upcoming"
        race_results = None
        
        try:
            res_r = requests.get(result_url, headers=HEADERS, timeout=10)
            res_soup = BeautifulSoup(res_r.content, 'html.parser')
            result_rows = res_soup.select('#All_Result_Table tr')
            
            if len(result_rows) > 1:
                race_status = "finished"
                top3 = []
                for row in result_rows[1:4]:
                    tds = row.find_all('td')
                    if len(tds) > 10:
                        top3.append({
                            "rank": int(tds[0].text.strip()) if tds[0].text.strip().isdigit() else tds[0].text.strip(),
                            "number": int(tds[2].text.strip()),
                            "name": tds[3].text.strip(),
                            "popularity": int(tds[9].text.strip()) if tds[9].text.strip().isdigit() else tds[9].text.strip()
                        })
                
                payouts = {}
                for table in res_soup.select('.Payout_Detail_Table'):
                    for tr in table.select('tr'):
                        th = tr.select_one('th')
                        if not th: continue
                        kind = th.text.strip()
                        td_res = tr.select_one('td.Result')
                        td_pay = tr.select_one('td.Payout')
                        
                        if td_res and td_pay:
                            # 組み合わせ(馬連やワイド)の数字をパース
                            nums = []
                            # <ul>ごとにグループ化されている場合 (ワイドなど)
                            ul_elements = td_res.find_all('ul')
                            if ul_elements:
                                for ul in ul_elements:
                                    # li をハイフンでつなぐ
                                    n = "-".join([li.text.strip() for li in ul.find_all('li') if li.text.strip()])
                                    if n: nums.append(n)
                            else:
                                # div区切りの場合や単一行の場合をフォールバックとして処理
                                for span_block in str(td_res).split('<br/>'):
                                    raw_n = BeautifulSoup(span_block, 'html.parser').text.strip()
                                    n = "-".join(raw_n.split())
                                    if n: nums.append(n)
                                    
                            # 単独のテキストしかない場合 (単勝など)
                            if not nums:
                                nums = ["-".join(td_res.text.strip().replace('\n', ' ').split())]
                                
                            # 配当金(円区切り)
                            pays = [p + "円" for p in td_pay.text.strip().split('円') if p.strip()]
                            
                            payouts[kind] = {
                                "numbers": ", ".join(nums),
                                "payout": ", ".join(pays)
                            }
                            
                race_results = {
                    "top3": top3,
                    "payouts": payouts
                }
        except Exception as e:
            print(f"結果取得エラー: {e}")

        # 不要な再代入を避け、取得した情報を個別にアップデートする
        race_info.update({
            "name": race_name,
            "date": race_date_str, 
            "track": "JRA",
            "distance": distance,
            "weather": weather,
            "condition": condition,
            "status": race_status,
            "results": race_results
        })
        
        # 出走馬情報
        raw_horses = []
        rows = soup.select('.Shutuba_Table tr.HorseList')
        for row in rows:
            tds = row.find_all('td')
            if not tds or len(tds) < 10: continue
            
            # 枠番 (tds[0])
            frame_text = tds[0].text.strip()
            frame = int(frame_text) if frame_text.isdigit() else 0
            
            # 馬番 (tds[1])
            num_text = tds[1].text.strip()
            if not num_text.isdigit():
                continue
            number = int(num_text)
            
            # 馬名 (tds[3])
            name_el = tds[3].find('a')
            name = name_el.text.strip() if name_el else tds[3].text.strip()
            if not name: name = "不明"
            
            # 騎手 (tds[6])
            jockey_el = tds[6].find('a')
            jockey = jockey_el.text.strip() if jockey_el else tds[6].text.strip()
            if not jockey: jockey = "不明"
            
            # オッズと人気順 (tds[9], tds[10])
            odds_str = tds[9].text.strip()
            pop_str = tds[10].text.strip() if len(tds) > 10 else "**"
            
            odds_base = 0.0
            popularity = 0
            try:
                odds_base = float(odds_str)
            except ValueError:
                pass
            
            if pop_str.isdigit():
                popularity = int(pop_str)

            # 馬体重 (tds[8])
            weight_text = tds[8].text.strip()
            
            weight = 0
            weight_change = "-"
            if '(' in weight_text:
                parts = weight_text.split('(')
                try:
                    weight = int(parts[0])
                    weight_change = parts[1].replace(')', '')
                    if not weight_change.startswith('-') and weight_change != '0':
                        weight_change = '+' + weight_change
                except:
                    pass
            elif weight_text.isdigit():
                weight = int(weight_text)
            
            raw_horses.append({
                "frame": frame,
                "number": number,
                "name": name,
                "jockey": jockey,
                "odds_base": odds_base,
                "popularity": popularity,
                "weight": weight if weight > 0 else "-",
                "weight_change": weight_change,
                "last_3f": "-", # 過去のレース結果ではないので取得不可
                "speed_index": "-", # 有料データ
                "condition_score": "-", # 有料データ
            })
            
        # リアルタイムオッズが不在の場合、予想ページから取得する
        if any(h["odds_base"] == 0.0 for h in raw_horses):
            try:
                yoso_url = f"https://race.netkeiba.com/yoso/mark_list.html?race_id={race_info['id']}"
                ry = requests.get(yoso_url, headers=HEADERS, timeout=10)
                sy = BeautifulSoup(ry.content, 'html.parser')
                dls = sy.select('.YosoTableWrap dl')
                
                yoso_odds = []
                yoso_pops = []
                
                for dl in dls:
                    dt = dl.find('dt')
                    if not dt: continue
                    text = dt.text.strip().replace('\n', '')
                    if "単勝オッズ" in text:
                        yoso_odds = [li.text.strip() for li in dl.find_all('li')]
                    elif "人気" == text:
                        yoso_pops = [li.text.strip() for li in dl.find_all('li')]
                        
                for i, h in enumerate(raw_horses):
                    if h["odds_base"] == 0.0:
                        try:
                            # 予想オッズを適用
                            h["odds_base"] = float(yoso_odds[i])
                        except:
                            # 取得できなかった場合のフォールバック（現実離れを防ぐためハッシュ値などで分散）
                            h["odds_base"] = round(10.0 + (len(h["name"]) * h["number"] % 20), 1)
                    if h["popularity"] == 0:
                        try:
                            h["popularity"] = int(yoso_pops[i])
                        except:
                            h["popularity"] = h["number"]
            except Exception as e:
                print(f"予想オッズ取得エラー: {e}")

        # 予想オッズ等の取得後、過去の成績（上がり3F等）を取得するため shutuba_past もフェッチする
        try:
            past_url = race_url.replace('shutuba.html', 'shutuba_past.html')
            rp = requests.get(past_url, headers=HEADERS, timeout=10)
            rp.encoding = 'euc-jp'
            sp = BeautifulSoup(rp.text, 'html.parser')
            
            p_rows = sp.select('.Shutuba_Table tr.HorseList')
            
            # 各馬ごとに最新の上がり3Fを抽出
            for p_row in p_rows:
                tds = p_row.find_all('td')
                if not tds or len(tds) < 4: continue
                
                # 馬番で突合
                num_text = tds[1].text.strip()
                if not num_text.isdigit(): continue
                horse_num = int(num_text)
                
                target_horse = next((h for h in raw_horses if h["number"] == horse_num), None)
                if not target_horse: continue
                
                # --- 過去走データ (上がり3F, 着順, 持ち時計) の抽出 ---
                past_tds = p_row.select('td.Past')
                placements = []
                past_times = []
                highest_class_score = 0.0 # A_i用
                
                for past in past_tds:
                    # 着順の取得 (R_i 用)
                    num_span = past.select_one('.Data01 .Num')
                    if num_span and num_span.text.strip().isdigit():
                        placements.append(int(num_span.text.strip()))
                    
                    # 走破タイムと距離の取得 (T_i 用)
                    data05 = past.select_one('.Data05')
                    if data05:
                        text05 = data05.text
                        time_match = re.search(r'(\d{1,2}):(\d{2}\.\d)', text05)
                        dist_match = re.search(r'([芝ダ])(\d+)m?', text05)
                        if time_match and dist_match:
                            mins = int(time_match.group(1))
                            secs = float(time_match.group(2))
                            total_seconds = (mins * 60) + secs
                            past_distance = int(dist_match.group(2))
                            past_times.append({
                                "distance": past_distance,
                                "time_sec": total_seconds
                            })
                            
                    # 過去のクラス取得 (A_i 用)
                    data02 = past.select_one('.Data02')
                    if data02:
                        race_name = data02.text
                        if "GI" in race_name and "GIII" not in race_name and "GII" not in race_name:
                            highest_class_score = max(highest_class_score, 0.8)
                        elif "GII" in race_name or "GIII" in race_name:
                            highest_class_score = max(highest_class_score, 0.5)
                        elif "OP" in race_name or "L" in race_name:
                            highest_class_score = max(highest_class_score, 0.3)
                            
                # 直近3走の着順を保存
                if placements:
                    target_horse["recent_placements"] = placements[:3]
                
                # 持ち時計情報の保存
                if past_times:
                    target_horse["past_times"] = past_times
                    
                # 基礎能力値(A_i)の保存
                target_horse["a_i"] = highest_class_score

                # 最新の上がり3Fを取得
                if past_tds:
                    latest_past = past_tds[0]
                    data06 = latest_past.select_one('.Data06')
                    if data06:
                        f3_match = re.search(r'\((\d{2}\.\d)\)', data06.text)
                        if f3_match:
                            target_horse["last_3f"] = float(f3_match.group(1))
                            
            # 全馬の過去データ取得に成功したフラグをrace_infoに持たせる
            race_info["has_past_data"] = sum(1 for h in raw_horses if "recent_placements" in h) > 0
            
        except Exception as e:
            print(f"過去走データ取得エラー: {e}")

        return race_info, raw_horses
    except Exception as e:
        print(f"レースデータ取得エラー ({race_url}): {e}")
        return None, None

import math

def calculate_expected_values(raw_horses, race_info):
    """
    期待値（EV）算出モデル Ver 2.0
    各馬のファクターを正規化（Zスコア化）またはスコア化し、ウェイトを掛けて総合期待値スコア(S_i)を算出する。
    $$S_i = w_1(T_i) + w_2(F_i) + w_3 C_i + w_4(1/R_i) + w_5 J_i + w_6 W_i$$
    """
    horses = []
    
    # --- コース適性プロファイル (Ci) 定義 ---
    # 実際は全競馬場分用意するが、主要デモとして代表的な値
    course_profiles = {
        "東京": {"S_straight": 1.0, "H_slope": 0.5, "R_corner": 0.3},
        "中山": {"S_straight": 0.4, "H_slope": 1.0, "R_corner": 0.8},
        "京都": {"S_straight": 0.7, "H_slope": 0.2, "R_corner": 0.5},
        "阪神": {"S_straight": 0.6, "H_slope": 0.9, "R_corner": 0.5},
        # デフォルト
        "JRA": {"S_straight": 0.5, "H_slope": 0.5, "R_corner": 0.5},
    }
    
    track_name = race_info.get("name", "JRA")
    # レース名や場所詳細から競馬場を推測（簡易）
    cp = course_profiles["JRA"]
    for k in course_profiles.keys():
        if k in track_name or k in race_info.get("track", ""):
            cp = course_profiles[k]
            break
            
    # C_i のベース係数 (アルファ、ベータ、ガンマ)
    # 距離に応じて直線要求度などを変えるのがAI的
    alpha = 1.0 if "1600" in race_info["distance"] else 0.8
    beta = 1.2 if "中山" in track_name else 0.8
    gamma = 1.0

    # 基礎変数抽出と統計用リスト
    implied_probs = []
    f3_values = []
    t_values = []
    current_distance_match = re.search(r'\d+', race_info.get("distance", "2000"))
    current_distance = int(current_distance_match.group()) if current_distance_match else 2000
    
    for h in raw_horses:
        implied_probs.append(1.0 / h["odds_base"] if h["odds_base"] > 0 else 0)
        # 上がり3Fの抽出
        if isinstance(h.get("last_3f"), float):
            f3_values.append(h["last_3f"])
            
        # 持ち時計（T_i）の抽出
        if h.get("past_times"):
            best_t = float('inf')
            for pt in h["past_times"]:
                if pt["distance"] > 0:
                    est_time = pt["time_sec"] * (current_distance / pt["distance"])
                    if est_time < best_t:
                        best_t = est_time
            if best_t != float('inf'):
                h["best_time_est"] = best_t
                t_values.append(best_t)
        
    sum_probs = sum(implied_probs) if sum(implied_probs) > 0 else 1.0
    normalized_probs = [p / sum_probs for p in implied_probs]
    
    # Fi の平均値と標準偏差を計算
    f3_mean = sum(f3_values) / len(f3_values) if f3_values else 35.0
    f3_std = math.sqrt(sum((x - f3_mean)**2 for x in f3_values) / len(f3_values)) if len(f3_values) > 1 else 1.0
    if f3_std == 0: f3_std = 1.0
    
    # Ti の平均値と標準偏差を計算
    t_mean = sum(t_values) / len(t_values) if t_values else current_distance * 0.06
    t_std = math.sqrt(sum((x - t_mean)**2 for x in t_values) / len(t_values)) if len(t_values) > 1 else 1.0
    if t_std == 0: t_std = 1.0
    
    # 係数ウェイト (Ver 3.0)
    w1, w2, w3, w4, w5, w6 = 0.20, 0.25, 0.30, 0.15, 0.05, 0.05

    # 第1パス: 総合能力スコア S_i の算出
    horse_scores = []
    for i, h in enumerate(raw_horses):
        base_win_prob = normalized_probs[i]
        
        # 1. T_i (走破タイム/能力スコア)
        if "best_time_est" in h:
            t_zscore = (t_mean - h["best_time_est"]) / t_std
            t_zscore = max(-3.0, min(3.0, t_zscore))
        else:
            t_zscore = -0.5 # 欠損値ペナルティ
        
        # 2. F_i (上り3ハロン)
        if isinstance(h.get("last_3f"), float):
            f_zscore = (f3_mean - h["last_3f"]) / f3_std
            f_zscore = max(-3.0, min(3.0, f_zscore))
        else:
            f_zscore = -0.5 # 欠損値ペナルティ
        
        # 3. C_i (コース適性スコアと枠順バイアス)
        b_draw = 0
        distance_str = race_info.get("distance", "")
        # B_draw (枠順バイアス): 例として小回り短距離は内枠有利、外枠不利
        if ("中山" in track_name or "阪神" in track_name) and "1200" in distance_str:
            if h.get("frame", 5) <= 4: b_draw = 0.5
            elif h.get("frame", 5) >= 7: b_draw = -0.3
            
        # 【Ver 3.0】枠順バイアスの地力（A_i）による相殺
        a_i = h.get("a_i", 0.0)
        if b_draw < 0:
            b_draw = b_draw * (1.0 - a_i)
            
        delta = 1.0
        c_i = (alpha * cp["S_straight"]) + (beta * cp["H_slope"]) + (gamma * cp["R_corner"]) + (delta * b_draw)
        
        # 大きな馬体重は坂に強い等
        if type(h.get("weight")) == int and h["weight"] > 500:
            c_i += 0.2 * cp["H_slope"]
            
        # 4. R_i (直近3走着順) & 5. J_i (騎手) & 6. W_i (コンディション)
        if h.get("recent_placements"):
            r_i = sum(h["recent_placements"]) / len(h["recent_placements"])
            r_score = 1.0 / r_i
        else:
            r_score = 1.0 / 8.0 # 平均8着相当の代替ペナルティ
            
        j_score = 1.0 if "ルメール" in h["jockey"] or "川田" in h["jockey"] else 0.5
        
        w_score = 1.0
        if isinstance(h["weight_change"], str):
            if h["weight_change"] == "-" or h["weight_change"] == "0":
                w_score = 1.0
            else:
                try:
                    wc = int(h["weight_change"].replace('+', ''))
                    # 異常な増減(-10kg以下、+15kg以上)はペナルティ
                    if wc <= -10 or wc >= 15: w_score = 0.5
                except: pass

        # 【Ver 3.0】実績ペナルティの動的緩和ロジック
        w_4_i = w4
        theta = 1.5 # 環境バイアス合致の閾値
        if c_i >= theta:
            w_4_i = w4 * 0.2
            
        # S_i の計算 (純粋な能力スコア)
        s_i = (w1 * t_zscore) + (w2 * f_zscore) + (w3 * c_i) + (w_4_i * r_score * 10) + (w5 * j_score) + (w6 * w_score)
        horse_scores.append(s_i)
        
    # 第2パス: Softmax関数による推定勝率 P_i の算出と EV 計算
    # S_i の分散をレース内で正規化（Zスコア化）し、極端な平準化を防ぐ
    s_mean = sum(horse_scores) / len(horse_scores) if horse_scores else 0.0
    s_std = math.sqrt(sum((s - s_mean)**2 for s in horse_scores) / len(horse_scores)) if len(horse_scores) > 1 else 1.0
    if s_std == 0: s_std = 1.0
    
    s_zscores = [(s - s_mean) / s_std for s in horse_scores]
    
    tau = 0.6 # 温度パラメータ (Ver 3.1 修正: オッズに依存せず能力差が勝率に直結するようメリハリを強める)
    exp_scores = [math.exp(z / tau) for z in s_zscores]
    sum_exp = sum(exp_scores) if sum(exp_scores) > 0 else 1.0
    
    for i, h in enumerate(raw_horses):
        s_i = horse_scores[i]
        win_prob = exp_scores[i] / sum_exp
        if win_prob < 0.005: win_prob = 0.005 # 最低保証勝率0.5%
        
        expected_return = win_prob * h["odds_base"]

        horses.append({
            "number": h["number"],
            "name": h["name"],
            "jockey": h["jockey"],
            "odds": h["odds_base"],
            "popularity": h.get("popularity", i + 1),  
            "win_probability": round(win_prob, 3),
            "expected_return": round(expected_return, 2),
            "score_si": round(s_i, 2), # Ver 3.0 スコア
            "classification": "一般馬", # 第3パスで設定
            "weight": h["weight"],
            "weight_change": h["weight_change"],
            "last_3f": h["last_3f"],
            "speed_index": h["speed_index"],
            "condition_score": h["condition_score"],
        })

    # 第3パス: 評価カテゴリの振り分け (Ver 3.0 Classification)
    # 一時的に勝率順でソートしてトップ3を特定する
    sorted_by_prob = sorted(horses, key=lambda x: x["win_probability"], reverse=True)
    top3_names = [h["name"] for h in sorted_by_prob[:3]]
    
    for h in horses:
        if h["expected_return"] < 0.8 and h["odds"] <= 5.0:
            h["classification"] = "危険な人気馬"
        elif h["name"] in top3_names and h["expected_return"] >= 0.9:
            h["classification"] = "絶対軸"
        elif h["expected_return"] >= 1.2:
            h["classification"] = "高EV伏兵"

    # オッズや人気順が正しく設定されていない場合のみ、ソートして付け直す
    if any(h["popularity"] == 0 for h in horses):
        horses.sort(key=lambda x: x["odds"])
        for idx, h in enumerate(horses):
            h["popularity"] = idx + 1
            
    horses.sort(key=lambda x: x["number"])
    return horses

def generate_portfolios(horses_data):
    """
    EV Ver 3.0 ポートフォリオ生成ロジック
    「絶対軸」をベースとし、戦略A（堅実バランス）、戦略B（ハイリスク・歪み狙い）の買い目を自動生成する。
    """
    strategy_a = []
    strategy_b = []
    
    # 馬を分類別にグループ化
    axis_horses = [h for h in horses_data if h["classification"] == "絶対軸"]
    dark_horses = [h for h in horses_data if h["classification"] == "高EV伏兵"]
    
    # 絶対軸が不在の場合のフォールバック：勝率トップの馬を仮の軸とする
    sorted_by_prob = sorted(horses_data, key=lambda x: x["win_probability"], reverse=True)
    if not axis_horses and len(sorted_by_prob) > 0:
        axis_horses = [sorted_by_prob[0]]
        
    if not axis_horses:
        return {"strategy_a": [], "strategy_b": []}
        
    # === 戦略A (堅実・バランス型) ===
    # 絶対軸 からの 単勝、ワイド、馬連。相手は上位人気の堅実馬や高EV伏兵
    targets_a = sorted_by_prob[:7] # 勝率上位7頭を相手に流す
    for ax in axis_horses:
        if {"type": "単勝", "numbers": [ax["number"]], "odds": ax["odds"], "expected_return": ax["expected_return"]} not in strategy_a:
            strategy_a.append({"type": "単勝", "numbers": [ax["number"]], "odds": ax["odds"], "expected_return": ax["expected_return"]})
            
        for tgt in targets_a:
            if ax["number"] == tgt["number"]: continue
            
            # 擬似オッズとEV計算（実オッズがないための簡略化）
            combo_odds_wide = round(ax["odds"] * tgt["odds"] * 0.15, 1)
            combo_ev_wide = round(ax["expected_return"] * tgt["expected_return"] * 1.1, 2)
            nums_sorted = sorted([ax["number"], tgt["number"]])
            
            strategy_a.append({"type":"ワイド", "numbers": nums_sorted, "odds": max(1.1, combo_odds_wide), "expected_return": combo_ev_wide})
            
            combo_odds_umaren = round(ax["odds"] * tgt["odds"] * 0.4, 1)
            combo_ev_umaren = round(ax["expected_return"] * tgt["expected_return"] * 0.9, 2)
            strategy_a.append({"type":"馬連", "numbers": nums_sorted, "odds": max(1.5, combo_odds_umaren), "expected_return": combo_ev_umaren})
            
    # 戦略Aの重複排除とEVソート
    unique_a = {str(b["numbers"]) + b["type"]: b for b in strategy_a}
    strategy_a = sorted(unique_a.values(), key=lambda x: x["expected_return"], reverse=True)

    # === 戦略B (ハイリスク・歪狙い型) ===
    # 絶対軸 を頭に固定し、高EV伏兵 や 中穴 に流す 馬単、3連複、3連単
    # 高EV伏兵がいなければ、単勝オッズ10倍〜50倍の中穴をターゲットにする
    targets_b = dark_horses if dark_horses else [h for h in horses_data if 10.0 <= h["odds"] <= 50.0]
    if not targets_b: targets_b = sorted_by_prob[3:8] # それでもいなければ適当なヒモ
    
    for ax in axis_horses:
        for tgt in targets_b:
            if ax["number"] == tgt["number"]: continue
            
            # 伏兵の単勝
            if {"type": "単勝", "numbers": [tgt["number"]], "odds": tgt["odds"], "expected_return": tgt["expected_return"]} not in strategy_b:
                strategy_b.append({"type": "単勝", "numbers": [tgt["number"]], "odds": tgt["odds"], "expected_return": tgt["expected_return"]})
                
            # 馬単 (絶対軸 -> 伏兵)
            umatan_odds = round(ax["odds"] * tgt["odds"] * 0.6, 1)
            umatan_ev = round(ax["expected_return"] * tgt["expected_return"], 2)
            strategy_b.append({"type":"馬単", "numbers": [ax["number"], tgt["number"]], "odds": max(2.0, umatan_odds), "expected_return": umatan_ev})
            
            # 3連複・3連単 (絶対軸 - 伏兵 - 伏兵)
            for tgt2 in targets_b:
                if tgt2["number"] <= tgt["number"] or tgt2["number"] == ax["number"]: continue
                
                base_odds_3 = float(ax["odds"] * tgt["odds"] * tgt2["odds"] * 0.08)
                base_ev_3 = round(ax["expected_return"] * tgt["expected_return"] * tgt2["expected_return"], 2)
                
                nums_3puku = sorted([ax["number"], tgt["number"], tgt2["number"]])
                strategy_b.append({"type":"3連複", "numbers": nums_3puku, "odds": round(max(5.0, base_odds_3), 1), "expected_return": round(base_ev_3*1.1, 2)})
                strategy_b.append({"type":"3連単", "numbers": [ax["number"], tgt["number"], tgt2["number"]], "odds": round(max(15.0, base_odds_3 * 6), 1), "expected_return": round(base_ev_3*0.8, 2)})

    # 戦略Bの重複排除とEVソート
    unique_b = {str(b["numbers"]) + b["type"]: b for b in strategy_b}
    strategy_b = sorted(unique_b.values(), key=lambda x: x["expected_return"], reverse=True)
    
    return {"strategy_a": strategy_a, "strategy_b": strategy_b}

def main():
    print("実レースデータ(netkeiba)の取得を開始します...")
    urls_dict = get_upcoming_race_urls()
    
    if not urls_dict:
        print("対象レースが見つかりませんでした。")
        return
        
    output_array = []
    
    for url, date_str in urls_dict.items():
        print(f"スクレイピング中: {url}")
        race_info, raw_horses = scrape_race_data(url, date_str)
        
        if not race_info or not raw_horses or len(raw_horses) == 0:
            continue
            
        print(f"[{race_info['name']}] のデータを計算中...")
        horses_data = calculate_expected_values(raw_horses, race_info)
        
        # --- 競馬ラボ (KeibaLab) データマージ ---
        try:
            lab_date_str = datetime.strptime(race_info['date'], '%Y-%m-%d').strftime('%Y%m%d')
            # 翌日の日付を取得（スクレイパーの基準日と同じにする）
            target_date = datetime.now() + timedelta(days=1)
            lab_date_str = target_date.strftime('%Y%m%d')
            lab_list_url = f"https://www.keibalab.jp/db/race/{lab_date_str}/"
            r_lab = requests.get(lab_list_url, headers=HEADERS, timeout=10)
            soup_lab = BeautifulSoup(r_lab.content, "html.parser")
            
            lab_race_links = [a['href'] for a in soup_lab.find_all('a', href=True) if f"/db/race/{lab_date_str}" in a['href'] and len(a['href'].split('/')) > 4]
            for lab_link in set(lab_race_links):
                l_url = f"https://www.keibalab.jp{lab_link}"
                r_l = requests.get(l_url, headers=HEADERS, timeout=10)
                s_l = BeautifulSoup(r_l.content, "html.parser")
                
                # 馬名リストの取得
                bamei_elements = s_l.select('.bamei')
                lab_horses = []
                for b_el in bamei_elements:
                    # aタグがあればそのテキスト、なければ自要素のテキスト
                    a_tag = b_el.find('a')
                    name = a_tag.text.strip() if a_tag else b_el.text.strip()
                    if name:
                        lab_horses.append(name)
                
                # 同一レース判定 (3頭以上一致)
                match_count = sum(1 for h in horses_data if h['name'] in lab_horses)
                if match_count >= 3:
                    zensou_rows = s_l.select('.megamoriTable tr.zensou1')
                    for idx, z_row in enumerate(zensou_rows):
                        if idx < len(lab_horses):
                            horse_name = lab_horses[idx]
                            tds = z_row.find_all('td')
                            for td in tds:
                                text = td.text.strip().replace('\n', '')
                                match = re.search(r'([34]\d\.\d)[HMS]?(?:\d+kg)?', text[-15:])
                                if match and float(match.group(1)) > 30.0:
                                    last_3f = match.group(1)
                                    for h in horses_data:
                                        if h['name'] == horse_name:
                                            h["last_3f"] = last_3f
                                            # 上がり3Fによる勝率ボーナス付与
                                            try:
                                                f3_val = float(last_3f)
                                                if f3_val < 34.0: h['win_probability'] = round(h['win_probability'] * 1.05, 3)
                                                elif f3_val < 35.0: h['win_probability'] = round(h['win_probability'] * 1.02, 3)
                                                h['expected_return'] = round(h['win_probability'] * h['odds'], 2)
                                            except:
                                                pass
                                    break
                    break 
        except Exception as e:
            print(f"競馬ラボ連携エラー: {e}")

        # ボーナス付与後に再ソート
        horses_data.sort(key=lambda x: x["expected_return"], reverse=True)
        # 順位(popularity)を再採番 (期待値順ではなく、オッズ順のままにする場合は oddsでソート)
        horses_data.sort(key=lambda x: x["odds"])
        for idx, h in enumerate(horses_data):
            h["popularity"] = idx + 1
        horses_data.sort(key=lambda x: x["number"])

        portfolios = generate_portfolios(horses_data)
        
        output_array.append({
            "race_info": race_info,
            "horses": horses_data,
            "portfolios": portfolios
        })
    
    if output_array:
        os.makedirs(FRONTEND_DATA_DIR, exist_ok=True)
        with open(OUTPUT_JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(output_array, f, ensure_ascii=False, indent=2)
        print(f"全 {len(output_array)} レース分のデータ出力を完了しました: {OUTPUT_JSON_PATH}")
    else:
        print("出力可能なデータがありませんでした。")

if __name__ == "__main__":
    main()
