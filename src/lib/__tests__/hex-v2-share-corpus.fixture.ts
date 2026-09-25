// FROZEN v2 SHARE PAYLOADS, copied VERBATIM from the configurator
// (bioscale-viz, branch feat/explode-everything, src/hex/v2/share-corpus.fixture.ts,
// literal links "exactly as the encoder wrote them on 2026-09-22").
//
// WHY A COPY: the academy's `decodeV2State` is a port of the configurator's, and
// the only honest proof the two agree is the configurator's OWN frozen output --
// a round trip through an academy-side encoder would agree with itself by
// construction. Every link here must decode on the academy to exactly `state`.
//
// DO NOT REGENERATE TO MAKE A TEST PASS. If the configurator adds an entry, copy
// it in; an existing entry never changes (a payload that stops decoding is a
// saved build that stopped opening).
//
// `v2u` is kept for the record only: the academy refuses the uncompressed branch.

export interface FrozenV2Build {
  readonly name: string;
  readonly v2s: string;
  readonly v2u: string;
  readonly state: unknown;
}

export const FROZEN_V2_PAYLOADS: readonly FrozenV2Build[] = [
  {
    "name": "empty",
    "v2s": "v2s=q1YqU7Iy1FEqVrKqVirITE1OLVayio7VUSrOSyyAMQsys2HCyfllqUUwNlxFZl5xalEJlJORmJeSg1Cfl5eaXJIP01NUmgdjZRZDTaqtBQA",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "minimal",
    "v2s": "v2s=RczBDgIhDATQf5kzB732V4wHgjUSmy62LBfCv5vdgF6aN8lMOxroGuCgjpI5sYNuHR_QJcDOK9xYTrVoOWoF4bmLYNwDXGM5JgdLfvN02hrb8q-R1dnqDK-oD_n3VTnVbW1s16Xs89MYXw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "pieces",
    "v2s": "v2s=lY_BCgMhDET_Zc4p1Ku_UjyIzbJSyVp1vcj-e6m7UmihtJcwgTczSUOFVoQM3RA9O87Ql4Y79JmQ-gxcOXRVbfJWCjSmNQRs1EH1DZxtmE7yO5oH-l6vPusNIYuN_1z8tER_618aglsqp6H3JEPwkjmVY5mtXMOLF2FXluFJqwzl85G0bQ8",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A1%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22half-n%22%7D%2C%7B%22q%22%3A1%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22half-s%22%7D%2C%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A1%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 1,
          "r": 0,
          "level": 0,
          "variant": "half-n"
        },
        {
          "q": 1,
          "r": 0,
          "level": 0,
          "variant": "half-s"
        },
        {
          "q": 0,
          "r": 0,
          "level": 1,
          "variant": "full"
        }
      ],
      "snaps": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "snaps",
    "v2s": "v2s=lY29CgMhEITfZWqLpN1XCRbi7RHJsmdcz0Z894A5SZ1m-Abmp6OB7g4G6siJIxvo0fEG3RzKVOHGMqmFkoJWEPZTBMM7mIb8byWn17zxDvFoXBZ_l7xDUuNSL_MMuskvr8qxHqtTTl2U7Foa4wM",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "spikes",
    "v2s": "v2s=hY7BDoMgEET_ZXrdA1zxUxoPBLcpKV0sID0o_2402vTmZfM2eTOZGRVGEzLMjNGz4wxzn_GBUYS038CVw07VJm-lwOAxhYBGf6K-FvV1Y0_IYsdtxIajf-2DoG6K1KJIL5pU946TlK4b4lfQE1ysnI6I-4W9ZE7leJ5WhsCnE0XYlXhm0iQn-Xw0tbYC",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A0%2C%22r%22%3A1%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A1%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%220%230%2C0%7C0%2C1%7C1%2C0%3Bmount%3B%3Bdown%22%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 0,
          "r": 1,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 1,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [
        "0#0,0|0,1|1,0;mount;;down"
      ],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "coversBare",
    "v2s": "v2s=RYyxDgIhEET_ZWoKbLlPMVcQXCORLLhwNIR_N3uiNpM32X0z0OEuBhVuoEQKVOGuAy84ayBnJuqUTupeoucGh_uREuZuUNkXVRRLfNLikDuJMqyxxm76v7VcoLefEbmStFUenm_p7zNTaFlWl4O_FOtneZ_zDQ",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%22%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [
        "0,0,0;full;top"
      ],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "coversTurned",
    "v2s": "v2s=RY29DgIhEITfZWoKbCy4xvcwVxBclUgWXDgags9uOFGbyTfJ_DRUmINChmlInhxlmHPDE0YryK6BKoWdqhVvucDguoWAvipktmlUBib_oMkuVpLB0EorvYz8UmI6HfXrJrYQRuhX9ZxJyjR3y5fwH2ImV6JMLxt_yefPxdr7Gw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%4060~grate%22%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [
        "0,0,0;full;top@60~grate"
      ],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "caps",
    "v2s": "v2s=hY7BCoMwEET_ZXorW4gVrMRL_6N4CLpiaIg2US8Sv72YRnprL8tjeOzMigUyI3jIFaPmhj3kY8ULUhBcvIYXNpEW5bSyEyS62RgEimL-S-yV6S72UIu_KiPUBG_VuA_ZcdRPTtwMC7uDPwYECRLVucpzsWU9CHkMTtX1JjY_GN2CUKQsK1N2z0qBmqCtZzell72yrfl2WcvNNBx9brYHaZ9WhPAG",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A3%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22half-n%22%7D%2C%7B%22q%22%3A6%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22half-e%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%220%2C0%2C0%3B*%3B330~1h%22%2C%223%2C0%2C0%3B%23%3B270~solid%22%2C%226%2C0%2C0%3B%23%3B180~solid%40180%22%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 3,
          "r": 0,
          "level": 0,
          "variant": "half-n"
        },
        {
          "q": 6,
          "r": 0,
          "level": 0,
          "variant": "half-e"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [
        "0,0,0;*;330~1h",
        "3,0,0;#;270~solid",
        "6,0,0;#;180~solid@180"
      ],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "insertsBare",
    "v2s": "v2s=bY1BDgIhDEXv8teYoIkuIJ7EzIJgjUSmIDBsCHc3jKNu3DSv6X_9DRVqL5ChGqIjSxnq0vCEkgJpnZ4q-ZWqSc5wgcJt8R59Eshs4lAGRvegjW2olAZDCimkHnldQsS4fQ3HmVL5E9MneT4c53nnOA_lbvjqf7-ZyZaQtj0t_CGX361T7y8",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%22%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%3B60%3D25mm-ins%22%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [
        "0,0,0;full;top"
      ],
      "caps": [],
      "inserts": [
        "0,0,0;full;top;60=25mm-ins"
      ],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "insertsTurned",
    "v2s": "v2s=bY7BDoIwEET_Zc4lqSZyKNH4H4ZDg0tsLEttSy-EfzeLiBcvmzfZmZ2dUWAOCglmRnDUUYK5zXjBaIW4Tk-F_ErFRmc5w6CfvMfSKiS2QSKCwT1p424sFIWhlVa6EX-TxwDZ7QnHiWL-Y2tqfT6ehqFynKqeBuvpsmtR11rLqYflu_91MlOXx7jpOPGXXPp80y7LGw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%22%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%3B60%3D25mm-ins-female%3E25mm-ins-male%4060%22%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [
        "0,0,0;full;top"
      ],
      "caps": [],
      "inserts": [
        "0,0,0;full;top;60=25mm-ins-female>25mm-ins-male@60"
      ],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "handles",
    "v2s": "v2s=lY9BCsIwEEXv8tcRUkWRFL2IdBHqFIPppCZpNqV3l9S2iAjiZnjD_AfzBySoQiBADegM1RSgLgMeUFLAT9NSIjtR0t5ojlBoemsxVgKBdZeVjJ2508y1S-QzQwopZJnzZXQd8m01DAfy8UusLI7ytN237cZw2DTUakvndc8bxKeyk38rh19GJXDTfLX09uPSwjFTHZ2fu_ieFzLh1b0axyc",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%22%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%220%2C0%2C0%3Bfull%3Btop%3B180%3D25mm-ins-female%3E25mm-ins-male%22%2C%220%2C0%2C0%3Bfull%3Btop%3B300%3D25mm-ins-female%3E25mm-ins-male%22%2C%220%2C0%2C0%3Bfull%3Btop%3B60%3D25mm-ins-female%3E25mm-ins-male%22%5D%2C%22handles%22%3A%5B%220%2C0%2C0%3Btop%22%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [
        "0,0,0;full;top"
      ],
      "caps": [],
      "inserts": [
        "0,0,0;full;top;180=25mm-ins-female>25mm-ins-male",
        "0,0,0;full;top;300=25mm-ins-female>25mm-ins-male",
        "0,0,0;full;top;60=25mm-ins-female>25mm-ins-male"
      ],
      "handles": [
        "0,0,0;top"
      ],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "accessories",
    "v2s": "v2s=PY1NCoMwEIXv8txGiLuSVe9RugjTKQbDxGY0tIg9ezGYboZvHu9nQ4EbDBRuwxyYWOFuG15w1iDXG7lwrFR8Dl4WODzXGLHfDVT8fEQOnMPEJ1MqnBv_HUGU83I-o5dHbH5PxKophyrAdtbYzn5HfveeqJ_4M6bI1-FiUdtFmJbUFvIqjYKeu_v-Aw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22accessories%22%3A%5B%220%230%2C0%230~hex-acc-keyhole%40180%22%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "accessories": [
        "0#0,0#0~hex-acc-keyhole@180"
      ],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "ports",
    "v2s": "v2s=PY3BDsIgEES_xemVJuvFAyf_w3ggdbVEskUoxITUbzdF8DJ5M5mdLcjQR4UIXeAtTxyhLwUvaFIIVR1ndpWyCdbICo17cg7bVSGK8fvJjt4-ufG0ZA6d_w0rkcPazGzk5nrfL78cNJCigT4zv8c9HL1Lj_OJDlZQd0V4Wpe-HZJ0srF93LYv",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22ports%22%3A%5B%220%230%2C0%230~hex-port-plug%4060!in%22%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "ports": [
        "0#0,0#0~hex-port-plug@60!in"
      ],
      "connectors": [],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "bins",
    "v2s": "v2s=RY7BCsMgEET_Zc4G7KUHT_2PkoNJt2SpbKwaKQT77UWJ6WV5O8wMsyPDXBQizA7PNFOEue94w2iF0K6jTK5RtoGtJBg8N-dQRoUo1tdIRc8vOnheM4XOp4MlUkjHs1h5uL9fhOa09kzYpBPHs2nipkIrrfR3oc8wsQx1y-2qMZbyAw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%2C%22bins%22%3A%5B%220%2C0%2C0~hex-bin-full%4060%22%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": [],
      "bins": [
        "0,0,0~hex-bin-full@60"
      ]
    }
  },
  {
    "name": "binBolts",
    "v2s": "v2s=RczBCoMwEATQfxmvCcRrjv2N4iHqWpcuG5ukUhD77UVRe1newswsmOFrgwy_YGLqKMPfF7zgnUHar9BMsmsOiYMWeAxvEayNQdYwbZWNEz_pcBdnSqevBGumVI5nDNrLP69KXYlnJ731FOdrqWW9RdkH4CpnXFV_R_rYltW2UYql_kF2sDkK92jW9Qc",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%2C%22binBolts%22%3A%5B%220%230%2C0%231~hex-bin-bolt-edge-f-solid%22%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": [],
      "binBolts": [
        "0#0,0#1~hex-bin-bolt-edge-f-solid"
      ]
    }
  },
  {
    "name": "connectors",
    "v2s": "v2s=hY1LDsIwDETvMmxdKdmGo6AuQmpEROSW_Dald68ahbJkYz3LbzwrKowmJJgVi2fHCea24g2jCLHNwJVDo2qjt5Jh8CghYKMm6v_iSEhil-P3gYt_cWc3V45fPg0viWPuy9PKFH6-CLs8twzURZH6aFLX5CcezuMwzeUeGCMhFunR6FOv2rYd",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A1%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%220%230%2C0%7C1%2C0%3Bside-connector-double%22%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 1,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [
        "0#0,0|1,0;side-connector-double"
      ],
      "runs": [],
      "risers": []
    }
  },
  {
    "name": "runs",
    "v2s": "v2s=hY0xDsIwDEXv8r1mcGDLVRBDFIyIiNLiJF2q3h0ltDCy2O9L79srFjhrUOBWzFGCFLjLihccG-iYSRZJgxav0ecKh3tLCZsZov0vXg1K9nO_3XGOT9k5TIvowV8j5iJa9_Dw-ZZ-fs4S6nR0tOVOUEtMbNgwnT_bMMFAT8RkR2IiKlVbqE19Qi_Hsj_ftjc",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A1%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%22r1%230%230%2C0%2C0%233%230%2C0%2C0%2C0%23%22%2C%22r2%230%231%2C0%2C0%230%23%23%23structural%22%5D%2C%22risers%22%3A%5B%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 1,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "snaps": [],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [
        "r1#0#0,0,0#3#0,0,0,0#",
        "r2#0#1,0,0#0###structural"
      ],
      "risers": []
    }
  },
  {
    "name": "risers",
    "v2s": "v2s=lY4xDsMgEAT_svUVuOUrEQXCFwUFnTFgGsTfo2CjFEmT5rQrzY6uoUIvhAzdED07ztC3hh1aEdK4gSuHkapN3kqBxv0IAZ1-gss3aAhZbPzH_Z5E_xz_GILbKqeZT5MheMmcylUeVtbw4UXYlW1u0iEz-XyaoEiRgun9BQ",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A1%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%220%2C0%2C0%22%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 0,
          "r": 0,
          "level": 1,
          "variant": "full"
        }
      ],
      "snaps": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "spikes": [],
      "covers": [],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": [
        "0,0,0"
      ]
    }
  },
  {
    "name": "coverHubs",
    "v2s": "v2s=lY6xDsIwDET_5WYP7Rp-gH9AGdJiRETkBCfNUpVvRylFINGFxbqTnu9uRoXpCRlmRvI8coY5zbjDdARdb-DKYVXVqXdSYHCZQsBCu2D_C1pCFpf-yW4vyd_WPZYwxsraNDrqqD806FBiegwxFDTgFW8JXjJr2czVyTl8QkR4LFE3r5O8lc-s31XHadhpg12WJw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A1%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22spikes%22%3A%5B%5D%2C%22covers%22%3A%5B%220%2C0%2C1%3Bfull%3Btop~bolt%22%5D%2C%22caps%22%3A%5B%5D%2C%22inserts%22%3A%5B%5D%2C%22handles%22%3A%5B%5D%2C%22connectors%22%3A%5B%5D%2C%22runs%22%3A%5B%5D%2C%22risers%22%3A%5B%5D%2C%22coverHubs%22%3A%5B%220%2C0%2C1%3Bfull%3Btop%22%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 0,
          "r": 0,
          "level": 1,
          "variant": "full"
        }
      ],
      "snaps": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "spikes": [],
      "covers": [
        "0,0,1;full;top~bolt"
      ],
      "caps": [],
      "inserts": [],
      "handles": [],
      "connectors": [],
      "runs": [],
      "risers": [],
      "coverHubs": [
        "0,0,1;full;top"
      ]
    }
  },
  {
    "name": "everything",
    "v2s": "v2s=nZLbasMwDIafZcrdkEFOulISNsqu9g6jFzm4q6ljZ3YSNnp49mGnpB0tNNtNiKXvl2X92kEPKUdwkO6gkaIUDtL3HXxCSgg2fJXohQp_fW5lrltIYd0pBQe8APl9kE-tGE8Fk6ng7L8gvwZXCE7nzTioCbW9pJHbMFygiJD2hHzPkbLadLrNQpa5tqtghVCaXtjAxkhImS-StaZZzgkQkl8xQJghIR8Dx8KoNlQZegQK_GOW0NEZJcMNUjth2xtXZHN6jp_qmknt2FrUuRIv49mfbvWQ8cUd1bUkoT9L7rXmH7bJdaWGOQ9qP6IVQl6Wwjlj5YUHUXzciC-WlyXbiu-NUWLJF-TpxpyGM3A8cD7IGtV9LOf0IPVglNaibI29MNab6mQl2JhklemKoT3b6YBaHnmaI0VJFIWMdCfPvZ00rsFbV4zRs8k-XUh99jd0WEjNPOE9GoBXoy4fkoyYXxImqg_B1uy0FYfDDw",
    "v2u": "v2u=%7B%22v%22%3A1%2C%22s%22%3A%7B%22pieces%22%3A%5B%7B%22q%22%3A0%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A0%2C%22r%22%3A1%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A1%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A2%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A3%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A4%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%2C%7B%22q%22%3A4%2C%22r%22%3A0%2C%22level%22%3A1%2C%22variant%22%3A%22full%22%7D%5D%2C%22snaps%22%3A%5B%7B%22q%22%3A4%2C%22r%22%3A0%2C%22level%22%3A0%2C%22variant%22%3A%22full%22%7D%5D%2C%22spikes%22%3A%5B%220%230%2C0%7C0%2C1%7C1%2C0%3Bmount%3Bspike-stud%22%5D%2C%22covers%22%3A%5B%222%2C0%2C0%3Bfull%3Btop%4060%22%2C%223%2C0%2C0%3Bfull%3Btop%22%2C%224%2C0%2C1%3Bfull%3Btop~bolt%22%5D%2C%22caps%22%3A%5B%220%2C0%2C0%3B*%3B30~solid%22%5D%2C%22inserts%22%3A%5B%222%2C0%2C0%3Bfull%3Btop%3B60%3D25mm-ins-female%3E25mm-ins-male%4060%22%2C%223%2C0%2C0%3Bfull%3Btop%3B180%3D25mm-ins-female%3E25mm-ins-male%22%2C%223%2C0%2C0%3Bfull%3Btop%3B300%3D25mm-ins-female%3E25mm-ins-male%22%2C%223%2C0%2C0%3Bfull%3Btop%3B60%3D25mm-ins-female%3E25mm-ins-male%22%5D%2C%22handles%22%3A%5B%223%2C0%2C0%3Btop%22%5D%2C%22accessories%22%3A%5B%220%230%2C0%232~hex-acc-keyhole%40180%22%5D%2C%22ports%22%3A%5B%220%230%2C0%231~hex-port-plug%4060!in%22%5D%2C%22connectors%22%3A%5B%220%230%2C0%7C1%2C0%3Bside-connector-double%22%5D%2C%22runs%22%3A%5B%22r1%230%230%2C1%2C0%233%23%23%22%5D%2C%22risers%22%3A%5B%224%2C0%2C0%22%5D%2C%22coverHubs%22%3A%5B%224%2C0%2C1%3Bfull%3Btop%22%5D%2C%22bins%22%3A%5B%220%2C0%2C0~hex-bin-full%4060%22%5D%2C%22binBolts%22%3A%5B%220%230%2C0%233~hex-bin-bolt-edge-f-solid%22%5D%7D%7D",
    "state": {
      "pieces": [
        {
          "q": 0,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 0,
          "r": 1,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 1,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 2,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 3,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 4,
          "r": 0,
          "level": 0,
          "variant": "full"
        },
        {
          "q": 4,
          "r": 0,
          "level": 1,
          "variant": "full"
        }
      ],
      "snaps": [
        {
          "q": 4,
          "r": 0,
          "level": 0,
          "variant": "full"
        }
      ],
      "spikes": [
        "0#0,0|0,1|1,0;mount;spike-stud"
      ],
      "covers": [
        "2,0,0;full;top@60",
        "3,0,0;full;top",
        "4,0,1;full;top~bolt"
      ],
      "caps": [
        "0,0,0;*;30~solid"
      ],
      "inserts": [
        "2,0,0;full;top;60=25mm-ins-female>25mm-ins-male@60",
        "3,0,0;full;top;180=25mm-ins-female>25mm-ins-male",
        "3,0,0;full;top;300=25mm-ins-female>25mm-ins-male",
        "3,0,0;full;top;60=25mm-ins-female>25mm-ins-male"
      ],
      "handles": [
        "3,0,0;top"
      ],
      "accessories": [
        "0#0,0#2~hex-acc-keyhole@180"
      ],
      "ports": [
        "0#0,0#1~hex-port-plug@60!in"
      ],
      "connectors": [
        "0#0,0|1,0;side-connector-double"
      ],
      "runs": [
        "r1#0#0,1,0#3##"
      ],
      "risers": [
        "4,0,0"
      ],
      "coverHubs": [
        "4,0,1;full;top"
      ],
      "bins": [
        "0,0,0~hex-bin-full@60"
      ],
      "binBolts": [
        "0#0,0#3~hex-bin-bolt-edge-f-solid"
      ]
    }
  }
];
