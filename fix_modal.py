with open('frontend/src/modules/cost360/components/CatalogResourceTab.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<th className="px-4 py-2 text-left font-semibold text-slate-600">Descripción de la Partida</th>',
    '<th className="px-4 py-2 text-left font-semibold text-slate-600">CovPar</th>\n                              <th className="px-4 py-2 text-left font-semibold text-slate-600">Descripción de la Partida</th>'
)
content = content.replace(
    '<th className="px-4 py-2 text-left font-semibold text-slate-600">DescripciÃ³n de la \nPartida</th>',
    '<th className="px-4 py-2 text-left font-semibold text-slate-600">CovPar</th>\n                              <th className="px-4 py-2 text-left font-semibold text-slate-600">DescripciÃ³n de la \nPartida</th>'
)
content = content.replace(
    '<th className="px-4 py-2 text-left font-semibold text-slate-600">DescripciÃ³n de la Partida</th>',
    '<th className="px-4 py-2 text-left font-semibold text-slate-600">CovPar</th>\n                              <th className="px-4 py-2 text-left font-semibold text-slate-600">DescripciÃ³n de la Partida</th>'
)

content = content.replace(
    '<td className="px-4 py-2.5 text-slate-700">{apu.Descri}</td>',
    '<td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">{apu.CovPar || "-"}</td>\n                                <td className="px-4 py-2.5 text-slate-700">{apu.Descri}</td>'
)

with open('frontend/src/modules/cost360/components/CatalogResourceTab.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
