#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成数据覆盖率与质量报告（Markdown），供内部质检与 B 端交付材料使用。

用法：python3 scripts/quality_report.py [输出路径]
不带参数则打印到 stdout。
"""
import json, sys, statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

SUBJECT_NAME = {
    "math": "数学", "english": "英语", "chinese": "语文", "physics": "物理",
    "science": "科学", "morality": "道德与法治", "history": "历史", "geography": "地理",
}
# 数学 grade -> 册（人教版一至九 + 高中）
MATH_BOOK = {
    (1, "上"): "一上", (1, "下"): "一下", (2, "上"): "二上", (2, "下"): "二下",
    (3, "上"): "三上", (3, "下"): "三下", (4, "上"): "四上", (4, "下"): "四下",
    (5, "上"): "五上", (5, "下"): "五下", (6, "上"): "六上", (6, "下"): "六下",
    (7, "上"): "七上", (7, "下"): "七下", (8, "上"): "八上", (8, "下"): "八下",
    (9, "上"): "九上", (9, "下"): "九下",
    (10, "上"): "必修一", (11, "上"): "必修二", (12, "上"): "选必一",
    (13, "上"): "选必二", (14, "上"): "选必三",
}


def subj(t):
    return t.get("subject") or "math"


def main():
    topics = json.loads((DATA / "topics.json").read_text(encoding="utf-8"))
    deps = json.loads((DATA / "dependencies.json").read_text(encoding="utf-8"))
    qraw = json.loads((DATA / "questions.json").read_text(encoding="utf-8"))
    questions = qraw["questions"] if isinstance(qraw, dict) and "questions" in qraw else qraw

    ids = {t["id"] for t in topics}
    t2s = {t["id"]: subj(t) for t in topics}
    qper = Counter(x["topicId"] for x in questions)

    out = []
    w = out.append
    w("# 数据覆盖率与质量报告")
    w("")
    w("> 本报告由 `scripts/quality_report.py` 从 `data/` 自动生成，数字可复算。")
    w("")
    w("## 1. 总览")
    w("")
    w("| 指标 | 数值 |")
    w("|---|---|")
    w(f"| 知识点总数 | {len(topics)} |")
    w(f"| 先修边总数 | {len(deps)}（hard {sum(1 for d in deps if d.get('strength','hard')=='hard')} / soft {sum(1 for d in deps if d.get('strength')=='soft')}） |")
    w(f"| 题目总数 | {len(questions)} |")
    dangling = [d for d in deps if d["topicId"] not in ids or d["prerequisiteId"] not in ids]
    w(f"| 悬空先修边（指向不存在节点） | {len(dangling)} |")
    w(f"| 无先修边的根节点 | {sum(1 for t in topics if not any(d['topicId']==t['id'] for d in deps))} |")
    w(f"| 有题目的知识点 | {sum(1 for t in topics if qper[t['id']] > 0)} / {len(topics)}（{sum(1 for t in topics if qper[t['id']] > 0)/len(topics)*100:.1f}%） |")
    w(f"| 有课标映射的知识点 | {sum(1 for t in topics if t.get('standards'))} / {len(topics)}（{sum(1 for t in topics if t.get('standards'))/len(topics)*100:.1f}%） |")
    w(f"| 有掌握标准 mastery_criteria | {sum(1 for t in topics if t.get('mastery_criteria'))} |")
    withv = sum(1 for x in questions if x.get("verify"))
    w(f"| 机器可判分题目（verify 字段） | {withv} / {len(questions)}（{withv/len(questions)*100:.1f}%） |")
    w(f"| 配示意图题目 | {sum(1 for x in questions if x.get('figure'))} |")
    w("")

    w("## 2. 分学科")
    w("")
    w("| 学科 | 知识点 | 题目 | 有题率 | 平均题/点 | 先修边 |")
    w("|---|---|---|---|---|---|")
    bysub = defaultdict(list)
    for t in topics:
        bysub[subj(t)].append(t)
    edge_by = Counter(t2s.get(d["topicId"]) for d in deps)
    q_by = Counter(t2s.get(x["topicId"]) for x in questions)
    for s in ["math", "english", "chinese", "physics", "science", "morality", "history", "geography"]:
        ts = bysub[s]
        withq = sum(1 for t in ts if qper[t["id"]] > 0)
        avg = q_by[s] / len(ts)
        w(f"| {SUBJECT_NAME[s]} | {len(ts)} | {q_by[s]} | {withq/len(ts)*100:.0f}% | {avg:.1f} | {edge_by[s]} |")
    w("")

    w("## 3. 数学分册覆盖（人教版）")
    w("")
    w("| 册 | 知识点 | 题目 |")
    w("|---|---|---|")
    book = defaultdict(list)
    for t in bysub["math"]:
        book[MATH_BOOK.get((t["grade"], t.get("semester")), str((t["grade"], t.get("semester"))))].append(t)
    order = list(MATH_BOOK.values())
    for b in order:
        ts = book.get(b, [])
        w(f"| {b} | {len(ts)} | {sum(qper[t['id']] for t in ts)} |")
    w("")

    w("## 4. 题目结构")
    w("")
    w("| 维度 | 分布 |")
    w("|---|---|")
    w("| 题型 | " + "；".join(f"{k} {v}" for k, v in Counter(x.get("type") for x in questions).most_common()) + " |")
    w("| 难度 | " + "；".join(f"{k} {v}" for k, v in Counter(x.get("difficulty") for x in questions).most_common()) + " |")
    counts = [qper[t["id"]] for t in topics]
    w(f"| 每点题量 | min {min(counts)} / 中位 {statistics.median(counts):.0f} / max {max(counts)} |")
    w("")

    w("## 5. 知识点类型与课标置信度")
    w("")
    w("| 维度 | 分布 |")
    w("|---|---|")
    w("| 知识点类型 | " + "；".join(f"{k} {v}" for k, v in Counter(t.get("type") for t in topics).most_common()) + " |")
    conf = Counter()
    for t in topics:
        for s in (t.get("standards") or []):
            conf[s.get("confidence")] += 1
    w("| 课标映射置信度 | " + "；".join(f"{k or '(无)'} {v}" for k, v in conf.most_common()) + " |")
    w("")

    w("## 6. 完整性检查")
    w("")
    dup_ids = [k for k, v in Counter(t["id"] for t in topics).items() if v > 1]
    edge_dups = len(deps) - len({(d["topicId"], d["prerequisiteId"]) for d in deps})
    no_reason = sum(1 for d in deps if not d.get("reason"))
    w(f"- 知识点 ID 重复：{len(dup_ids)}")
    w(f"- 重复先修边（脚本加载时去重前）：{edge_dups}")
    w(f"- 缺少 reason 的先修边：{no_reason}")
    w(f"- 悬空先修边：{len(dangling)}")
    w(f"- 无题目知识点：{sum(1 for c in counts if c == 0)}")
    w("")

    text = "\n".join(out)
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(text, encoding="utf-8")
        print(f"written: {sys.argv[1]}")
    else:
        print(text)


if __name__ == "__main__":
    main()
