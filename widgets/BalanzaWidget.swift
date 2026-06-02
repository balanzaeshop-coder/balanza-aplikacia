import WidgetKit
import SwiftUI

private let appGroup = "group.sk.balanza.walkingpad"
private let dataKey  = "widget_data"

// MARK: - Data model

struct WidgetData {
    var steps: Int    = 0
    var km: Double    = 0
    var minutes: Int  = 0
    var stepsGoal: Int   = 8000
    var kmGoal: Double   = 5
    var minutesGoal: Int = 60

    static func load() -> WidgetData {
        guard
            let defaults  = UserDefaults(suiteName: appGroup),
            let json      = defaults.string(forKey: dataKey),
            let raw       = json.data(using: .utf8),
            let dict      = try? JSONSerialization.jsonObject(with: raw) as? [String: Any]
        else { return WidgetData() }

        var d = WidgetData()
        d.steps       = dict["steps"]       as? Int    ?? 0
        d.km          = dict["km"]          as? Double ?? 0
        d.minutes     = dict["minutes"]     as? Int    ?? 0
        d.stepsGoal   = dict["stepsGoal"]   as? Int    ?? 8000
        d.kmGoal      = dict["kmGoal"]      as? Double ?? 5
        d.minutesGoal = dict["minutesGoal"] as? Int    ?? 60
        return d
    }
}

// MARK: - Timeline

struct BalanzaEntry: TimelineEntry {
    let date: Date
    let data: WidgetData
}

struct BalanzaProvider: TimelineProvider {
    func placeholder(in context: Context) -> BalanzaEntry {
        BalanzaEntry(date: Date(), data: WidgetData())
    }
    func getSnapshot(in context: Context, completion: @escaping (BalanzaEntry) -> Void) {
        completion(BalanzaEntry(date: Date(), data: WidgetData.load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<BalanzaEntry>) -> Void) {
        let entry      = BalanzaEntry(date: Date(), data: WidgetData.load())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }
}

// MARK: - Ring view

struct RingView: View {
    let progress: Double
    let color: Color
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 3) {
            ZStack {
                Circle()
                    .stroke(color.opacity(0.18), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: min(max(progress, 0), 1))
                    .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(value)
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color(red: 0.17, green: 0.16, blue: 0.24))
            }
            .frame(width: 52, height: 52)
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Widget view

struct BalanzaWidgetView: View {
    let entry: BalanzaEntry

    private var stepsLabel: String {
        entry.data.steps >= 1000
            ? String(format: "%.1fk", Double(entry.data.steps) / 1000)
            : "\(entry.data.steps)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Balanza")
                .font(.system(size: 12, weight: .bold))
                .foregroundColor(Color(red: 0.17, green: 0.16, blue: 0.24))

            HStack(spacing: 10) {
                RingView(
                    progress: Double(entry.data.steps) / Double(entry.data.stepsGoal),
                    color: Color(red: 0.17, green: 0.16, blue: 0.24),
                    label: "kroky",
                    value: stepsLabel
                )
                RingView(
                    progress: entry.data.km / entry.data.kmGoal,
                    color: Color(red: 0.49, green: 0.44, blue: 0.80),
                    label: "km",
                    value: String(format: "%.1f", entry.data.km)
                )
                RingView(
                    progress: Double(entry.data.minutes) / Double(entry.data.minutesGoal),
                    color: Color(red: 0.72, green: 0.68, blue: 0.91),
                    label: "min",
                    value: "\(entry.data.minutes)"
                )
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

// MARK: - Widget entry point

@main
struct BalanzaWidget: Widget {
    let kind = "BalanzaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BalanzaProvider()) { entry in
            if #available(iOS 17.0, *) {
                BalanzaWidgetView(entry: entry)
                    .containerBackground(
                        Color(red: 0.93, green: 0.92, blue: 0.96),
                        for: .widget
                    )
            } else {
                BalanzaWidgetView(entry: entry)
                    .background(Color(red: 0.93, green: 0.92, blue: 0.96))
            }
        }
        .configurationDisplayName("Balanza")
        .description("Dnešné štatistiky chôdze")
        .supportedFamilies([.systemSmall])
    }
}
