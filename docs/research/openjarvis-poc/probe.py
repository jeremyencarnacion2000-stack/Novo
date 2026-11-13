"""Isolated OpenJarvis primitive comparison. Synthetic fixtures only."""
import argparse
import json
from pathlib import Path
import statistics
import sys
import time
import tracemalloc
from types import ModuleType

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("tokenizer", type=Path)
args = parser.parse_args()
source = args.source.resolve() / "src"
sys.path.insert(0, str(source))

# Execute the pinned primitive files and their dependencies, without package
# initializers that eagerly load engines, persistent memory, and services.
for package in ("learning", "memory", "tools", "tools.storage"):
    name = "openjarvis." + package
    namespace = ModuleType(name)
    namespace.__path__ = [str(source / "openjarvis" / Path(*package.split(".")))]
    sys.modules[name] = namespace

from openjarvis.learning.routing.complexity import score_complexity
from openjarvis.core.types import Message, Role
from openjarvis.tools.storage.context import ContextConfig, build_context_message, inject_context
from openjarvis.tools.storage._stubs import RetrievalResult

sys.path.insert(0, str(args.tokenizer.resolve()))
import tiktoken
encoding = tiktoken.get_encoding("o200k_base")
def tokens(text):
    return len(encoding.encode_ordinary(text))

spec = [
    ("es","Abre Codex.","simple","desktop","project"),
    ("en","Open Codex.","simple","desktop","project"),
    ("es","¿Qué sigue en ClickHome?","simple","project","deployment"),
    ("en","What is next for ClickHome?","simple","project","deployment"),
    ("es","¿Tengo una reunión hoy?","simple","calendar","schedule"),
    ("en","Do I have a meeting today?","simple","calendar","schedule"),
    ("es","Busca qué tarea de ClickHome bloquea la próxima entrega.","simple","project","blocker"),
    ("en","Find which ClickHome task blocks the next release.","simple","project","blocker"),
    ("es","Compara dos planes de entrega. Primero evalúa sus dependencias, luego explica riesgos y decide qué priorizar.","complex","project","blocker"),
    ("en","Compare two release plans. First evaluate their dependencies, then explain the risks and decide what to prioritize.","complex","project","blocker"),
    ("es","Analiza por qué se solapan mis reuniones y explica cómo resolverlo paso a paso.","complex","calendar","schedule"),
    ("en","Analyze why my meetings overlap and explain how to resolve this step-by-step.","complex","calendar","schedule"),
    ("es","Analiza el código `const task = 1` y explica el error, luego plantea dos soluciones y sus riesgos.","complex","project","deployment"),
    ("en","Analyze the code `const task = 1` and explain the error, then propose two fixes and compare the risks.","complex","project","deployment"),
    ("es","Analiza los factores, compara sus efectos y decide qué conviene para ClickHome con evidencia del proyecto.","complex","project","blocker"),
    ("en","Analyze the factors, compare the trade-offs and decide what is best for ClickHome using project evidence.","complex","project","blocker"),
]
# All context is invented. The baseline represents already-authorized broad
# selection and never sees the denied or untrusted entries.
documents = [
    ("deployment","project","trusted","The ClickHome preview depends on the staging deployment being verified."),
    ("blocker","project","trusted","The blocking task is to validate the checkout integration before the release."),
    ("project","desktop","trusted","Codex is the registered desktop editor available for opening."),
    ("schedule","calendar","trusted","The next meeting starts at nine and ends before the release review."),
    ("private","project","denied","fixture owner mismatch"),
    ("untrusted","project","untrusted","untrusted fixture"),
]
for topic in ("project","desktop","calendar","routine","general"):
    documents.extend((f"{topic}-{i}",topic,"trusted",f"Background note {i}. " + ("General note about historical activity and preferences. " * 14)) for i in range(5))

class Backend:
    def __init__(self, topic, wanted):
        self.topic = topic
        self.wanted = wanted
    def retrieve(self, query, *, top_k):
        rows = [doc for doc in documents if doc[1]==self.topic and doc[2]!="denied"]
        rows.sort(key=lambda d: (d[0] == "untrusted", d[0] == self.wanted),reverse=True)
        return [RetrievalResult(body, 1.0, ident, {"trust":trust}) for ident,_,trust,body in rows[:top_k]]

def baseline():
    rows = [RetrievalResult(body, 1.0, ident, {"trust":trust}) for ident,_,trust,body in documents if trust=="trusted"]
    return build_context_message(rows).text

config=ContextConfig(top_k=5, max_context_tokens=170)
def run():
    rows=[]
    baseline_text=baseline()
    for language,query,expected,topic,wanted in spec:
        started=time.perf_counter_ns()
        complexity=score_complexity(query)
        model_tier="complex" if complexity.score>=.55 or complexity.signals["has_reasoning"] else "simple"
        backend=Backend(topic,wanted)
        messages=inject_context(query,[Message(role=Role.USER,content=query)],backend,config=config)
        context=messages[0].text
        elapsed=(time.perf_counter_ns()-started)/1e6
        assert "fixture owner mismatch" not in context and "untrusted fixture" not in context
        rows.append({"language":language,"expected":expected,"selected":model_tier,
                     "source_preserved":f"[Source: {wanted}]" in context,
                     "baseline_source_preserved":f"[Source: {wanted}]" in baseline_text,
                     "baseline_tokens":tokens(baseline_text),"candidate_tokens":tokens(context),"stage_ms":elapsed})
    return rows

run()
sample=run()
times=[]
for _ in range(35):
    times.extend(row["stage_ms"] for row in run())
tracemalloc.start()
run()
_,allocation_peak=tracemalloc.get_traced_memory()
tracemalloc.stop()
assert len(sample)==16 and all(row["source_preserved"] for row in sample)
cost_basis=0.50 # USD per million input tokens, illustrative and not provider pricing
before=sum(row["baseline_tokens"] for row in sample)
after=sum(row["candidate_tokens"] for row in sample)
print(json.dumps({"fixture_rows":sample,
    "context_source_accuracy":sum(row["source_preserved"] for row in sample),
    "routing_accuracy":{lang:sum(row["expected"]==row["selected"] for row in sample if row["language"]==lang) for lang in ("es","en")},
    "input_context_tokens_before":before,"input_context_tokens_after":after,
    "pricing_assumption_usd_per_million_input_tokens":cost_basis,
    "illustrative_cost_per_1000_queries_before_usd":before/len(sample)*1000*cost_basis/1e6,
    "illustrative_cost_per_1000_queries_after_usd":after/len(sample)*1000*cost_basis/1e6,
    "local_provider_spend_usd":0,"timed_repetitions":len(times),
    "stage_p50_ms":statistics.median(times),"stage_p95_ms":statistics.quantiles(times,n=100,method="inclusive")[94],
    "python_allocation_peak_kib":allocation_peak/1024,"tokenizer":"o200k_base","live_model_calls":0},indent=2))
