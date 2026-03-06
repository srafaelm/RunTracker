using RunTracker.Application.Training.DTOs;
using RunTracker.Domain.Enums;

namespace RunTracker.Application.Training;

/// <summary>A single workout entry in a plan, offset from race day.</summary>
public record PlanWorkout(
    int DaysFromRace,
    string Title,
    WorkoutType WorkoutType,
    double? DistanceMeters = null,
    string? Notes = null
);

public record TrainingPlanTemplate(
    string Id,
    string Name,
    string Description,
    int WeeksCount,
    List<PlanWorkout> Workouts
);

public static class TrainingPlanTemplates
{
    private static PlanWorkout W(int d, string t, WorkoutType wt, double? dist = null, string? n = null)
        => new(d, t, wt, dist, n);

    public static readonly List<TrainingPlanTemplate> All = new()
    {
        new TrainingPlanTemplate(
            "5k-beginner", "5K — Beginner", "8-week plan for first-time 5K runners", 8,
            new List<PlanWorkout>
            {
                W(-55, "Easy Run",   WorkoutType.Easy,      2000, "Start slow, walk if needed"),
                W(-53, "Walk/Run",   WorkoutType.Easy,      2000, "Run 1 min, walk 1 min × 10"),
                W(-51, "Easy Run",   WorkoutType.Easy,      2500),
                W(-48, "Easy Run",   WorkoutType.Easy,      2500),
                W(-46, "Walk/Run",   WorkoutType.Easy,      3000, "Run 2 min, walk 1 min × 8"),
                W(-44, "Easy Run",   WorkoutType.Easy,      3000),
                W(-41, "Easy Run",   WorkoutType.Easy,      3000),
                W(-39, "Tempo Run",  WorkoutType.Tempo,     3000, "Comfortably hard for 10 min"),
                W(-37, "Easy Run",   WorkoutType.Easy,      3500),
                W(-34, "Easy Run",   WorkoutType.Easy,      3500),
                W(-32, "Tempo Run",  WorkoutType.Tempo,     3500, "20 min at 5K effort"),
                W(-30, "Easy Run",   WorkoutType.Easy,      4000),
                W(-27, "Easy Run",   WorkoutType.Easy,      4000),
                W(-25, "Intervals",  WorkoutType.Intervals, 3000, "4 × 400m fast with 90s rest"),
                W(-23, "Easy Run",   WorkoutType.Easy,      4000),
                W(-20, "Easy Run",   WorkoutType.Easy,      4500),
                W(-18, "Tempo Run",  WorkoutType.Tempo,     4000, "25 min steady"),
                W(-16, "Easy Run",   WorkoutType.Easy,      4500),
                W(-13, "Easy Run",   WorkoutType.Easy,      4000),
                W(-11, "Intervals",  WorkoutType.Intervals, 3000, "5 × 400m at goal pace"),
                W(-9,  "Easy Run",   WorkoutType.Easy,      3000),
                W(-6,  "Easy Run",   WorkoutType.Easy,      3000, "Keep it easy"),
                W(-4,  "Strides",    WorkoutType.Easy,      2000, "Easy 20 min + 4 × 20s strides"),
                W(-2,  "Rest",       WorkoutType.Rest,      null, "Rest or short walk"),
                W(0,   "Race Day!",  WorkoutType.Race,      5000, "Go for it!"),
            }
        ),

        new TrainingPlanTemplate(
            "10k-beginner", "10K — Beginner", "10-week plan to run your first 10K", 10,
            new List<PlanWorkout>
            {
                W(-69, "Easy Run",   WorkoutType.Easy,      3000),
                W(-67, "Easy Run",   WorkoutType.Easy,      4000),
                W(-65, "Long Run",   WorkoutType.Long,      5000),
                W(-62, "Easy Run",   WorkoutType.Easy,      4000),
                W(-60, "Easy Run",   WorkoutType.Easy,      4000),
                W(-58, "Long Run",   WorkoutType.Long,      6000),
                W(-55, "Easy Run",   WorkoutType.Easy,      5000),
                W(-53, "Tempo Run",  WorkoutType.Tempo,     4000, "20 min at comfortably hard effort"),
                W(-51, "Long Run",   WorkoutType.Long,      7000),
                W(-48, "Easy Run",   WorkoutType.Easy,      5000),
                W(-46, "Intervals",  WorkoutType.Intervals, 4000, "6 × 400m"),
                W(-44, "Long Run",   WorkoutType.Long,      8000),
                W(-41, "Easy Run",   WorkoutType.Easy,      5000),
                W(-39, "Tempo Run",  WorkoutType.Tempo,     6000, "30 min tempo"),
                W(-37, "Long Run",   WorkoutType.Long,      9000),
                W(-34, "Easy Run",   WorkoutType.Easy,      5000),
                W(-32, "Intervals",  WorkoutType.Intervals, 5000, "8 × 400m"),
                W(-30, "Long Run",   WorkoutType.Long,     10000),
                W(-27, "Easy Run",   WorkoutType.Easy,      5000),
                W(-25, "Tempo Run",  WorkoutType.Tempo,     6000),
                W(-23, "Long Run",   WorkoutType.Long,      8000, "Cutback week"),
                W(-20, "Easy Run",   WorkoutType.Easy,      5000),
                W(-18, "Intervals",  WorkoutType.Intervals, 5000, "10 × 400m at goal pace"),
                W(-16, "Long Run",   WorkoutType.Long,     10000),
                W(-13, "Easy Run",   WorkoutType.Easy,      4000),
                W(-11, "Tempo Run",  WorkoutType.Tempo,     5000),
                W(-9,  "Long Run",   WorkoutType.Long,      8000, "Taper begins"),
                W(-6,  "Easy Run",   WorkoutType.Easy,      4000, "Taper"),
                W(-4,  "Strides",    WorkoutType.Easy,      3000, "Easy with strides"),
                W(-2,  "Rest",       WorkoutType.Rest),
                W(0,   "Race Day!",  WorkoutType.Race,     10000, "Go for it!"),
            }
        ),

        new TrainingPlanTemplate(
            "half-marathon-beginner", "Half Marathon — Beginner", "12-week first half marathon plan", 12,
            BuildHalfMarathon()
        ),

        new TrainingPlanTemplate(
            "marathon-beginner", "Marathon — Beginner", "16-week first marathon plan", 16,
            BuildMarathon()
        ),
    };

    private static List<PlanWorkout> BuildHalfMarathon()
    {
        var plan = new List<PlanWorkout>();
        double[] longDist = [8000, 10000, 12000, 13000, 14000, 16000, 14000, 18000, 16000, 19000, 12000, 21097];
        double[] easyDist = [5000, 5000, 6000, 6000, 7000, 7000, 6000, 8000, 7000, 8000, 5000, 4000];
        for (int w = 0; w < 12; w++)
        {
            int start = -(12 - w) * 7;
            plan.Add(W(start + 1, "Easy Run", WorkoutType.Easy, easyDist[w]));
            if (w < 11)
                plan.Add(W(start + 3, "Mid-week Quality", w % 2 == 0 ? WorkoutType.Tempo : WorkoutType.Intervals, easyDist[w]));
            plan.Add(W(start + 5, "Easy Run", WorkoutType.Easy, easyDist[w] - 1000));
            plan.Add(W(start + 6, w == 11 ? "Race Day!" : "Long Run", w == 11 ? WorkoutType.Race : WorkoutType.Long, longDist[w]));
        }
        return plan;
    }

    private static List<PlanWorkout> BuildMarathon()
    {
        var plan = new List<PlanWorkout>();
        double[] longKm = [12, 14, 16, 18, 14, 20, 22, 18, 24, 26, 20, 28, 22, 24, 16, 42.195];
        double[] easyKm = [6, 7, 7, 8, 6, 8, 8, 7, 9, 9, 7, 10, 8, 8, 5, 0];
        for (int w = 0; w < 16; w++)
        {
            int start = -(16 - w) * 7;
            plan.Add(W(start + 1, "Easy Run", WorkoutType.Easy, easyKm[w] * 1000));
            if (w < 15)
            {
                plan.Add(W(start + 3, "Mid-week Quality", w % 3 == 0 ? WorkoutType.Intervals : w % 3 == 1 ? WorkoutType.Tempo : WorkoutType.Easy, (easyKm[w] - 1) * 1000));
                plan.Add(W(start + 5, "Easy Run", WorkoutType.Easy, easyKm[w] * 1000));
            }
            plan.Add(W(start + 6, w == 15 ? "Race Day!" : "Long Run", w == 15 ? WorkoutType.Race : WorkoutType.Long, longKm[w] * 1000));
        }
        return plan;
    }
}
