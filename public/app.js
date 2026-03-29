const { createApp } = Vue;
const API_BASE = "https://cursor-s3z8.onrender.com"; // 
createApp({
  data() {
    return {
      inputText: "",
      activeTab: "text",
      mode: "precise",
      hmm: true,
      filterStopwords: false,
      loading: false,
      error: "",
      tokens: [],
      elapsed: "-",
      count: "-",
      fileName: "",
    };
  },
  methods: {
    triggerUpload() {
      this.$refs.fileInput?.click();
    },
    async onFileSelect(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      this.activeTab = "file";
      this.fileName = file.name;
      this.error = "";
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "上传失败");
        this.inputText = data.text || "";
      } catch (err) {
        this.error = err?.message || String(err);
      }
      e.target.value = "";
    },
    async doSegment() {
      this.error = "";
      this.loading = true;
      this.elapsed = "-";
      this.count = "-";
      if (!this.inputText.trim()) {
        this.error = "请输入或上传文本后再分词。";
        this.loading = false;
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/segment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: this.inputText,
            mode: this.mode,
            hmm: this.hmm,
            filter_stopwords: this.filterStopwords,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "请求失败");
        this.tokens = data.tokens || [];
        this.elapsed = data.elapsed_ms != null ? data.elapsed_ms + " ms" : "-";
        this.count = data.count != null ? String(data.count) : "-";
      } catch (err) {
        this.error = err?.message || String(err);
        this.tokens = [];
      } finally {
        this.loading = false;
      }
    },
    fillSample() {
      this.inputText =
        "我来到北京清华大学。\n面向文本分词系统的在线网站开发与实现，需要准确率与响应速度达标。\n职业教育与校企合作是高职院校的重要方向。";
    },
    clearAll() {
      this.inputText = "";
      this.tokens = [];
      this.elapsed = "-";
      this.count = "-";
      this.error = "";
      this.fileName = "";
      this.activeTab = "text";
    },
    tokensToText() {
      return this.tokens.map((t) => t.word).filter(Boolean).join(" ");
    },
    async copyResult() {
      const text = this.tokensToText();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        this.error = "已复制到剪贴板。";
        setTimeout(() => (this.error = ""), 1500);
      } catch {
        this.error = "复制失败";
      }
    },
    exportTxt() {
      const text = this.tokensToText();
      if (!text) return;
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "分词结果.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    },
    exportExcel() {
      if (!this.tokens.length || typeof XLSX === "undefined") return;
      const rows = [["序号", "词元"], ...this.tokens.map((t, i) => [i + 1, t.word])];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "分词结果");
      XLSX.writeFile(wb, "分词结果.xlsx");
    },
  },
}).mount("#app");
