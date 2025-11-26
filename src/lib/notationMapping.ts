export type NotationMap = Record<string, string>;

// Define reusable notation mappings
export const sharedNotationMapping: Record<string, NotationMap> = {
    soulCaliburButtons: {
        ":(B+C):": ":(B+K):",
        ":(B+D):": ":(B+G):",
        ":(C+D):": ":(K+G):",
        ":A+B+C:": ":A+B+K:",
        ":A+D:": ":A+G:",
        ":A+C:": ":A+K:",
        ":B+C:": ":B+K:",
        ":B+D:": ":B+G:",
        ":C+D:": ":K+G:",
        "(C)": "(K)",
        ":C:": ":K:",
        ":c:": ":k:",
        "(D)": "(G)",
        ":D:": ":G:",
        ":d:": ":g:",
    },
    weirdTekken: {
        ":2::3::6:": ":qcf:", // Quarter Circle Forward
        ":2::1::4:": ":qcb:", // Quarter Circle Back
        ":6::2::3:": ":dp:", // Dragon Punch motion
        ":4::1::2::3::6:": ":hcf:", // Half Circle Forward
        ":6::3::2::1::4:": ":hcb:", // Half Circle Back

        ":A:": ":LP:",
        ":B:": ":RP:",
        ":C:": ":LK:",
        ":D:": ":RK:",
    },
};
